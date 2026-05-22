# Forget-Me-Not

Forget-Me-Not is a proactive, context-aware, and offline-first digital assistant designed to streamline your task management and build healthy routines. It blends natural language processing with a calming, visually dynamic interface that adapts to your day.

## 🌟 Comprehensive Feature Set

### 1. Privacy-Centric, Offline-First Architecture
*   **Local Storage**: All tasks, routines, and profile data are stored directly on your device using seamless local storage (via Capacitor Preferences).
*   **No Forced Cloud**: Completely decoupled from cloud databases, ensuring your data never leaves your device unless you choose to export it.
*   **Manual Save Controls**: Optimistic auto-saving combined with a manual "Save" action for absolute peace of mind.
*   **Data Portability**: Built-in comprehensive JSON export and import tools allow you to seamlessly backup, migrate, or restore your entire database.

### 2. Adaptive Circadian UI
*   **Time-Aware Theming**: The application dynamically shifts its color palette, typography weights, and ambient visual mood based on the time of day:
    *   *Morning*: Bright, crisp, and energetic.
    *   *Afternoon*: Balanced and focused.
    *   *Evening/Night*: Dark, warm, and highly immersive to reduce eye strain.

### 3. AI-Powered Intelligence (Gemini)
*   **Smart Task Decomposition**: Use AI to automatically break down vague, overwhelming tasks into actionable, step-by-step subtasks.
*   **Natural Language Profiling**: Write a freeform bio or brain-dump of your habits, and the AI will extract actionable traits to inform how it organizes your work.

### 4. Deep Work & Focus Tools
*   **Focus Mode**: A highly immersive, full-screen overlay dedicated to a single active task. It hides all background noise and navigation.
*   **Focus Island**: A dynamic, interactive widget that tracks your current active focus session, allowing you to mark steps complete or bail out without navigating back to the main list.
*   **Subtask Scaffolding**: Keep momentum high by executing and checking off micro-steps sequentially.

### 5. Smart Organization & Categorization
*   **Inbox Array**: A holding zone for quickly captured thoughts.
*   **Life & Household Streams**: Separated operational domains so you can context-switch cleanly between personal admin and chores.
*   **Daily Routines**: Built-in support for recurring actions and daily checklists.

### 6. Interactive 'Weekly Wins' Dashboard
*   **Data Visualization**: Integrated chart systems (powered by Recharts) visualize your completion streaks, recent activity, and category breakdowns.
*   **Activity Reflection**: A holistic view of your most productive days and historical performance to foster psychological momentum.

### 7. Fluid Input Mechanics
*   **Pull-to-Capture**: A gesture-inspired physical pull-down input system on the main feed to capture tasks at the speed of thought without clicking into forms.

---

## 📅 Detailed Development Timeline

**Phase 1: Core Scaffolding & Visual Identity**
*   Initialized the React + Vite + Tailwind CSS framework.
*   Constructed the primary unified layout, establishing the modular architecture for components (Task Lists, Modals, Bottom Sheets).
*   Implemented the **Circadian UI hook**, binding the app's visual CSS variables directly to the user's local system time.

**Phase 2: Full-Stack Artificial Intelligence**
*   Built an Express backend to safely route AI requests.
*   Integrated the **Gemini API** to handle complex natural language tasks.
*   Created the "Decompose" action, enabling the UI to send a task string to Gemini and instantly receive back an array of logical subtasks.
*   Implemented profile parsing, where the AI reads a user's unstructured bio to generate settings.

**Phase 3: Analytics & Focus Mechanics**
*   Built the **Weekly Wins Dashboard**, bringing in `recharts` to render beautiful pie charts and bar graphs mapping user historical data.
*   Engineered **Focus Mode** and the floating **Focus Island**, requiring complex React state management to elevate a single task globally above the rest of the application tree.

**Phase 4: The Local-First Migration**
*   Pivoted away from traditional cloud dependency. Removed Firebase Authentication and Firestore integrations.
*   Built a robust `storageService.ts` proxy using `@capacitor/preferences` to handle device-native or browser-local persistent JSON storage.
*   Re-architected all asynchronous database calls (`dbService`) in the UI components to seamlessly address the local memory tree.

**Phase 5: Refinement, Simplification, & Polish**
*   Stripped out all legacy synchronization UI, replacing the continuous "Cloud Sync" loading states with a clean, instant **Local Save** architecture.
*   Conducted rigorous TypeScript linting sweeps, resolving type mismatches bridging the old cloud models and the new local storage definitions.
*   Finalized build tools (`vite build`, `esbuild`) ensuring the application compiles cleanly into a production-ready, lightning-fast static bundle.
