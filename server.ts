import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { dbService } from "./server/db.js";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Gemini Initialization
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Mock Auth - Since Firebase setup is failing with permissions, we use a simple local auth
app.post("/api/auth/login", (req, res) => {
  // Simple mock login that always succeeds for the preview
  res.json({ id: "user-123", email: "user@example.com", name: "User" });
});

// DB API Routes
app.get("/api/profile", async (req, res) => {
  const userId = req.headers['x-user-id'] as string || "user-123";
  res.json(await dbService.getProfile(userId));
});

app.post("/api/profile", async (req, res) => {
  const userId = req.headers['x-user-id'] as string || "user-123";
  const { bio } = req.body;
  await dbService.saveProfile(userId, bio);
  res.json({ success: true });
});

app.post("/api/profile/parse", async (req, res) => {
  const userId = req.headers['x-user-id'] as string || "user-123";
  const { rawText } = req.body;
  if (!rawText) return res.status(400).json({ error: "Missing raw text" });

  try {
    const prompt = `Act as a data extractor. Take the user's text and output STRICT, raw JSON matching this schema:
    - profession (string)
    - schedule (array of strings, e.g., working hours, specific shift days)
    - hobbies (array of strings, e.g., instruments, gaming, fitness)
    - pets (array of objects with 'type' and 'name')
    - hardware (array of strings, e.g., laptop models, phones)
    - goals (array of strings, e.g., upcoming board exams, personal projects)

    Return ONLY the raw JSON string.

    User Text:
    ${rawText}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const output = response.text || "{}";
    
    // Validate JSON
    const parsedObj = JSON.parse(output);
    const bioString = JSON.stringify(parsedObj);

    // Save to Firestore
    await dbService.saveProfile(userId, bioString);

    res.json({ success: true, bio: bioString });
  } catch (error) {
    console.error("Error parsing profile:", error);
    res.status(500).json({ error: "Failed to parse profile JSON. Please try again." });
  }
});

app.get("/api/tasks", async (req, res) => {
  const userId = req.headers['x-user-id'] as string || "user-123";
  const { status, limit } = req.query;
  const tasks = await dbService.getTasks(
    userId, 
    status as 'active' | 'completed' | undefined,
    limit ? parseInt(limit as string, 10) : undefined
  );
  res.json(tasks);
});

app.post("/api/tasks", async (req, res) => {
  const userId = req.headers['x-user-id'] as string || "user-123";
  const { title, description, category, tag, isRecurring, recurrenceInterval } = req.body;
  const task = await dbService.addTask(userId, title, description, category || 'life', tag, isRecurring, recurrenceInterval);
  res.json(task);
});

app.post("/api/tasks/:id/complete", async (req, res) => {
  const { id } = req.params;
  const task = await dbService.completeTask(id);
  res.json(task);
});

app.post("/api/tasks/:id/undo", async (req, res) => {
  const { id } = req.params;
  const task = await dbService.undoTask(id);
  res.json(task);
});

app.patch("/api/tasks/:id", async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const task = await dbService.updateTask(id, updates);
  res.json(task);
});

app.delete("/api/tasks/:id", async (req, res) => {
  const { id } = req.params;
  await dbService.deleteTask(id);
  res.json({ success: true });
});

app.get("/api/analytics", async (req, res) => {
  const userId = req.headers['x-user-id'] as string || "user-123";
  const allTasks = await dbService.getTasks(userId, 'completed');
  
  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  
  let days7 = 0;
  let days30 = 0;
  let days90 = 0;
  
  const completedByDate: Record<string, number> = {};
  const categoryCounts: Record<string, number> = { life: 0, household: 0 };
  const dayOfWeekCounts: Record<string, number> = {};
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  allTasks.forEach(t => {
    const d = new Date(t.completedAt || t.createdAt);
    const diffDays = (now.getTime() - d.getTime()) / msPerDay;
    
    if (diffDays <= 7) days7++;
    if (diffDays <= 30) days30++;
    if (diffDays <= 90) days90++;
    
    const dateStr = d.toDateString();
    completedByDate[dateStr] = (completedByDate[dateStr] || 0) + 1;
    
    if (t.category) {
      categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
    }
    
    const dayName = dayNames[d.getDay()];
    dayOfWeekCounts[dayName] = (dayOfWeekCounts[dayName] || 0) + 1;
  });
  
  // Calculate Streak
  let currentStreak = 0;
  let checkDate = new Date();
  while (true) {
    const dateStr = checkDate.toDateString();
    if (completedByDate[dateStr]) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      // If today has 0, check yesterday. If yesterday has 0, streak is 0.
      if (currentStreak === 0 && checkDate.toDateString() === now.toDateString()) {
        checkDate.setDate(checkDate.getDate() - 1);
        if (!completedByDate[checkDate.toDateString()]) {
          break;
        }
      } else {
        break;
      }
    }
  }
  
  // Most productive day
  let mostProductiveDay = 'N/A';
  let maxCount = -1;
  for (const [day, count] of Object.entries(dayOfWeekCounts)) {
    if (count > maxCount) {
      maxCount = count;
      mostProductiveDay = day;
    }
  }

  // Last 7 days chart data
  const chartData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toDateString();
    chartData.push({
      date: dateStr,
      shortDate: d.toLocaleDateString(undefined, { weekday: 'short' }),
      count: completedByDate[dateStr] || 0
    });
  }

  res.json({
    days7,
    days30,
    days90,
    currentStreak,
    mostProductiveDay,
    categoryCounts,
    chartData,
    recentTasks: allTasks.filter(t => (now.getTime() - new Date(t.completedAt || t.createdAt).getTime()) / msPerDay <= 7).slice(0, 15) // send max 15 recent to reflection
  });
});

app.post("/api/reflect", async (req, res) => {
  const { bio, recentTasks } = req.body;
  if (!bio || !recentTasks) {
    return res.status(400).json({ error: "Missing bio or recentTasks" });
  }

  try {
    const prompt = `You are a grounded, supportive mentor acting within a minimalist productivity app called 'Forget-Me-Not'. 
The user has requested a 'Reflection' on their recent progress. 
User's Bio Context: ${JSON.stringify(bio)}
Tasks completed in the last 7 days: ${JSON.stringify(recentTasks.map((t: any) => t.title))}

Write a 2-3 sentence personalized message. 
1. Highlight a specific recent win from their completed tasks (e.g., sticking to a routine, knocking out a tough chore).
2. Acknowledge their context/constraints if relevant.
3. Offer realistic, low-pressure encouragement to keep going. Do NOT use toxic productivity tropes (e.g., "crush it", "hustle").

Keep it warm, empathetic, and concise.`;

    const fallbackModels = [
      "gemini-2.5-flash",
      "gemini-3-flash-preview",
      "gemini-3.1-flash-lite",
      "gemini-2.5-flash-lite"
    ];

    let response;
    let lastError = null;

    for (const model of fallbackModels) {
      try {
        response = await ai.models.generateContent({
          model: model,
          contents: prompt,
          config: {
            temperature: 0.7,
          }
        });
        break; 
      } catch (e) {
        console.warn(`Model ${model} failed, trying next...`);
        lastError = e;
      }
    }

    if (!response) {
      throw lastError;
    }

    res.json({ message: response.text });
  } catch (error) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: "Failed to generate reflection." });
  }
});

app.post("/api/anticipate", async (req, res) => {
  const { bio, completedTasks, existingTasks, currentTime, category } = req.body;

  if (!bio) {
    return res.status(400).json({ error: "Context bio is required" });
  }

  try {
    const avoidList = existingTasks && existingTasks.length > 0 ? existingTasks.join(', ') : '';
    
    let prompt = `
      Current Date/Time: ${currentTime}
      User Master Bio (JSON): ${bio}
      Recently Completed Tasks: ${completedTasks?.join(", ") || "None"}
      
      CURRENT CONTEXT: The user already has the following tasks on their active list: [ ${avoidList} ]. 
      CRITICAL RULE: You MUST NOT suggest any tasks that are identical, or highly similar with the items in this list. Your generated suggestions must be completely new or additive.

      CRITICAL INSTRUCTIONS:
      1. Avoid Caricature: Do not force every single task to tie back to the user's specific profession, pets, or hobbies. It is required to suggest normal, mundane tasks like 'Do the laundry', 'Take out the trash', or 'Pay the electricity bill' without tying them to a specific life goal.
      2. Strict Mathematical Ratios: You MUST count the total number of suggestions you are generating and strictly enforce the personal/universal ratio instructed below. Your final JSON array MUST mathematically respect this ratio.
      3. For complex, multi-step tasks (especially within the 'Life Focus' category, like studying for an exam or building a project), you MUST generate 3 to 5 actionable subtasks (or more if required, see category rules) and populate the \`subtasks\` array. Each subtask MUST be an object with \`text\` (string) and \`isCompleted\` (boolean, default false).
      4. For simple, single-action chores (like 'Take out the trash' or 'Drink water'), leave the \`subtasks\` array empty \`[]\`.
    `;
    
    if (category === 'routines') {
      prompt += `
      Generate "Routine Bundles" – recurring tasks that contain pre-set checklists of related habits grouped together (e.g., a "Push Day" workout bundle, a "Guitar Practice" bundle, or a "Sunday Reset").
      Instead of suggesting single, isolated habits, group related actions into a single bundle and populate the \`subtasks\` array with specific steps.
      RATIO REQUIREMENT: 30% Personal / 70% Universal.
      - 70% of the suggested bundles MUST be generic, standard maintenance that applies to the general public.
      - 30% should pull from the user's specific JSON profile context.
      Assign a relevant 1-2 word tag to each task based on the context.
      Ensure the AI returns a recurrenceInterval (e.g. "daily", "weekly", "monthly", "yearly") and strictly sets isRecurring: true.
      You must assign an \`effortLevel\` ('low', 'medium', or 'high') to every suggested bundle based on the complete effort of its subtasks.
      Examples: 
      - {"title": "Sunday Reset", "description": "Weekly apartment deep clean and prep.", "tag": "Home", "isRecurring": true, "recurrenceInterval": "weekly", "effortLevel": "medium", "subtasks": [{"text": "Wipe kitchen counters", "isCompleted": false}, {"text": "Take out trash", "isCompleted": false}]}
      - {"title": "Progressive Rock Practice", "description": "Structured guitar practice session.", "tag": "Guitar", "isRecurring": true, "recurrenceInterval": "daily", "effortLevel": "high", "subtasks": [{"text": "10 mins pentatonic scales", "isCompleted": false}, {"text": "Learn one Porcupine Tree riff", "isCompleted": false}]}
      Return the response as a STRICT JSON array of objects, where each object has "title", "description", "tag", "isRecurring" (boolean, true), "recurrenceInterval" (string: "daily", "weekly", "monthly", "yearly"), "effortLevel" (string), and "subtasks" (array of objects).
      `;
    } else if (category === 'life') {
      prompt += `
      Generate deep-work, career, or personal growth tasks. These should be one-off steps toward larger goals.
      RATIO REQUIREMENT: 70% Personal / 30% Universal.
      - 70% of the suggested tasks MUST be directly derived from the user's specific JSON profile context (e.g., career milestones, exam prep, specific hobbies, coding projects).
      - 30% should be general life admin or universal deep-work habits (e.g., "Clear out email inbox", "Review monthly budget").
      Assign a relevant 1-2 word tag to each task based on the context (e.g. "Board Prep", "Career", "Guitar").
      Set isRecurring: false.
      NEW RULE FOR LIFE FOCUS: You MUST generate a comprehensive \`subtasks\` array for EVERY single task you suggest. Do NOT limit this to 3-5 items. Generate as many granular, actionable subtasks as necessary to fully break down the project from start to finish.
      You must assign an \`effortLevel\` ('low', 'medium', or 'high') to every suggested task. Simple chores and quick 5-minute tasks must be 'low'. Heavy study sessions or complex projects must be 'high'.
      Examples: 
      - {"title": "Complete 50 Cardiology Board flashcards", "description": "Focus on the ischemic heart disease section. Review incorrect answers thoroughly.", "tag": "Board Prep", "isRecurring": false, "effortLevel": "medium"}
      - {"title": "Practice E Minor Pentatonic scale", "description": "Spend 20 minutes with the metronome at 80bpm working on alternate picking.", "tag": "Guitar", "isRecurring": false, "effortLevel": "medium"}
      Return the response as a STRICT JSON array of objects, where each object has "title", "description", "tag", "isRecurring" (boolean, false), "effortLevel" (string), and "subtasks" (array of objects). Do not include recurrenceInterval.
      `;
    } else { // category === 'household'
      prompt += `
      Generate physical chores, errands, or shopping items.
      RATIO REQUIREMENT: 30% Personal / 70% Universal.
      - 70% of the suggested tasks MUST be generic, standard household maintenance that applies to the general public (e.g., doing laundry, taking out the trash, wiping counters).
      - 30% should pull from the user's specific JSON profile context (e.g., personalized shift prep, specific vehicle maintenance, or pet care).
      Assign a relevant 1-2 word tag to each task based on the context (e.g. "Groceries", "Car Maintenance", "Pets").
      Set isRecurring: false.
      You must assign an \`effortLevel\` ('low', 'medium', or 'high') to every suggested task. Simple chores and quick 5-minute tasks must be 'low'. Heavy study sessions or complex projects must be 'high'.
      Examples: 
      - {"title": "Buy Ziko's millet", "description": "Stop by the pet store on the way home to pick up a fresh bag of millet sprays.", "tag": "Pets", "isRecurring": false, "effortLevel": "low"}
      - {"title": "Meal prep for Tuesday's 24h ICU shift", "description": "Cook three portions of chicken and rice to bring to the hospital.", "tag": "Shift Prep", "isRecurring": false, "effortLevel": "high"}
      Return the response as a STRICT JSON array of objects, where each object has "title", "description", "tag", "isRecurring" (boolean, false), "effortLevel" (string), and "subtasks" (array of objects). Do not include recurrenceInterval.
      `;
    }

    const fallbackModels = [
      "gemini-3-flash-preview",
      "gemini-2.5-flash",
      "gemini-3.1-flash-lite",
      "gemini-2.5-flash-lite"
    ];

    let lastError: any = null;

    for (const model of fallbackModels) {
      try {
        const response = await ai.models.generateContent({
          model: model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  tag: { type: Type.STRING },
                  isRecurring: { type: Type.BOOLEAN },
                  recurrenceInterval: { type: Type.STRING, enum: ["daily", "weekly", "monthly", "yearly"] },
                  effortLevel: { type: Type.STRING, enum: ["low", "medium", "high"] },
                  subtasks: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        text: { type: Type.STRING },
                        isCompleted: { type: Type.BOOLEAN, description: "Always default to false" }
                      }
                    }
                  }
                },
                required: ["title", "description", "tag", "effortLevel"]
              }
            }
          }
        });

        const suggestions = JSON.parse(response.text || "[]");
        // Successfully generated suggestions, return and break out of loop
        return res.json({ suggestions });
      } catch (error: any) {
        console.warn(`Model ${model} failed: ${error.message}. Attempting next model...`);
        lastError = error;
      }
    }

    console.error("All Gemini API fallback models failed. Last error:", lastError);
    return res.status(500).json({ error: "Failed to generate suggestions. Please try again later." });
  } catch (error: any) {
    console.error("General Error:", error);
    return res.status(500).json({ error: "Failed to handle anticipation request" });
  }
});

app.post("/api/sort-inbox", async (req, res) => {
  const { tasks } = req.body;
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({ error: "Tasks array is required" });
  }

  try {
    const prompt = `You are an intelligent task organizer. Look at the following list of tasks. For each task, determine if it belongs in 'household' (chores, errands, home-related), 'life' (studying, career, hobbies, deep work), or 'routines'. Then, assign an appropriate effort level (low, medium, high) and priority (low, medium, high). Return the exact same IDs provided to you. Use 'household' instead of 'home'.
    
    Here are the tasks:
    ${JSON.stringify(tasks, null, 2)}
    
    Return the response as a STRICT JSON array of objects, where each object has "id", "category" ("life" or "household" or "routines"), "effortLevel" ("low", "medium", "high"), and "priority" ("low", "medium", "high").
    Note: The system only natively supports 'life', 'household', and 'routines' in this context (we will map 'routines' nicely). Actually, please only output 'life', 'household', or 'inbox' if you cannot decide. Wait, no, only 'life' or 'household'.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              category: { type: Type.STRING, enum: ["life", "household", "routines"] },
              effortLevel: { type: Type.STRING, enum: ["low", "medium", "high"] },
              priority: { type: Type.STRING, enum: ["low", "medium", "high"] }
            },
            required: ["id", "category", "effortLevel", "priority"]
          }
        }
      }
    });

    const sortedResults = JSON.parse(response.text || "[]");
    return res.json({ sortedResults });
  } catch (error: any) {
    console.error("Sort Inbox Error:", error);
    return res.status(500).json({ error: "Failed to handle sort request" });
  }
});

app.post("/api/decompose-task", async (req, res) => {
  const { title, description } = req.body;
  if (!title) {
    return res.status(400).json({ error: "Task title is required" });
  }

  try {
    const prompt = `You are a productivity expert. Break the following task into highly specific, immediately actionable steps that take less than 20 minutes each. Determine the appropriate number of steps based on the task's complexity—generate as few or as many steps as necessary to fully break it down. Return the steps in chronological order. Task: ${title} ${description ? `- ${description}` : ''}.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING }
            },
            required: ["text"]
          }
        }
      }
    });

    const steps = JSON.parse(response.text || "[]");
    return res.json({ steps });
  } catch (error: any) {
    console.error("Decompose Task Error:", error);
    return res.status(500).json({ error: "Failed to handle decompose request" });
  }
});

// Vite Middleware for Development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
