# New Project Guidelines: Context and Structure

To ensure a new project starts efficiently, providing the right context from the outset is crucial. This document outlines the ideal information and folder structure, prioritized from most to least critical.

---

### Phase 1: Core Project Definition (Essential for Kick-off)

This initial information is non-negotiable for understanding the project's purpose and scope.

1.  **Project Brief & Goals:**
    *   A high-level description of the project.
    *   What problem does it solve?
    *   Who are the target users?
    *   What are the primary business goals?

2.  **Core Feature List:**
    *   A prioritized list of the main features.
    *   User stories are highly effective here (e.g., "As a user, I can...").

3.  **Technical Stack Constraints:**
    *   **Languages:** (e.g., JavaScript, Python, Java)
    *   **Frameworks:** (e.g., React, Django, Spring)
    *   **Database:** (e.g., PostgreSQL, MongoDB, Firebase Firestore)
    *   **Deployment Target:** (e.g., AWS, Firebase, Vercel)
    *   Any existing systems or APIs that need to be integrated.

---

### Phase 2: Design and Data (Required for Implementation)

Once the core concept is clear, this information is needed to begin development.

4.  **UI/UX Mockups or Wireframes:**
    *   Visual representations of the application's screens.
    *   Tools like Figma, Sketch, or even hand-drawn sketches are acceptable.
    *   If no designs are available, a clear description of the desired layout and user flow is necessary.

5.  **Data Schema / API Definitions:**
    *   A definition of the data models (e.g., what fields does a `user` or `product` have?).
    *   If interacting with external APIs, provide the API documentation (e.g., OpenAPI/Swagger specs).

---

### Phase 3: Project Setup and Workflow (Best Practices)

This information helps ensure a well-organized and maintainable project.

6.  **Proposed Folder Structure:**
    *   A clear and logical project layout is key. Here is a recommended generic structure for a full-stack application:

    ```
    /project-root
    |-- /client           # Frontend (e.g., React, Vue)
    |   |-- /src
    |   |   |-- /components
    |   |   |-- /pages
    |   |   |-- /services
    |   |-- package.json
    |
    |-- /server           # Backend (e.g., Node/Express, Django)
    |   |-- /src
    |   |   |-- /controllers
    |   |   |-- /models
    |   |   |-- /routes
    |   |-- package.json
    |
    |-- /docs             # Project documentation
    |   |-- /api
    |   |-- /design
    |
    |-- README.md         # Project overview, setup, and deployment
    ```

7.  **Version Control Workflow:**
    *   Confirmation of using a version control system like Git.
    *   A preferred branching strategy (e.g., GitFlow, Trunk-Based Development).

By providing this information in a structured way, we can align on the project's vision and technical requirements from day one, leading to a faster and more successful development cycle.