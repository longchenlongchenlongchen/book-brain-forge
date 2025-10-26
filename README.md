# BookBrain

Transform your textbooks into AI-powered flashcards and master your studies with intelligent learning tools.

## 📖 Introduction

BookBrain is an AI-powered learning platform that converts PDF textbooks into interactive flashcards, quizzes, and concept maps. Using advanced AI and vector embeddings, it helps students study more effectively through spaced repetition and intelligent content generation.

## ✨ Features

- **PDF Processing**: Upload textbooks and automatically extract content with AI-powered chunking
- **Smart Flashcards**: Generate contextual flashcards from your study materials
- **Multiple Choice Quizzes**: Create MCQ tests based on book content
- **Concept Mapping**: Visualize hierarchical concepts with interactive flow diagrams
- **Spaced Repetition**: Review flashcards with a proven learning algorithm
- **Progress Tracking**: Monitor your learning progress across all materials

## 🏗️ Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: Shadcn/ui + Radix UI
- **State Management**: TanStack Query (React Query)
- **Routing**: React Router v6
- **Visualizations**: ReactFlow for concept maps, Recharts for analytics

### Backend (Lovable Cloud)
- **Database**: PostgreSQL with pgvector extension for embeddings
- **Authentication**: Supabase Auth with email/password
- **Storage**: Supabase Storage for PDF files
- **AI Processing**: Edge Functions with Lovable AI gateway

### Edge Functions
1. **process-pdf**: Extracts text, generates embeddings, and chunks content
2. **generate-flashcards**: Creates flashcards using AI from book content
3. **generate-mcq**: Generates multiple-choice questions
4. **generate-concepts**: Builds hierarchical concept maps

### Database Schema
- `books`: Store uploaded textbooks metadata
- `materials`: PDF file references and processing status
- `chunks`: Text chunks with vector embeddings
- `decks`: Flashcard collections
- `cards`: Individual flashcards with spaced repetition data
- `concepts`: Hierarchical concept nodes for visualization

## 🚀 How to Run This Project

### Prerequisites
- Node.js 18+ and npm
- Git

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/longchenlongchenlongchen/book-brain-forge.git
cd book-brain-forge
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment Setup**

This project uses Lovable Cloud for backend services. To run locally:

**Option A: Connect to Lovable Cloud (Recommended)**
- The project is pre-configured with Lovable Cloud
- Environment variables are automatically provided when running through Lovable
- No additional setup needed if using Lovable development environment

**Option B: Local Development Setup**

If running outside of Lovable, you'll need to configure environment variables:

1. Create a `.env` file in the project root:
```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
VITE_SUPABASE_PROJECT_ID=your_project_id
```

2. Get your credentials:
   - Open your project in [Lovable](https://lovable.dev/projects/453f4c28-b2c8-4b06-8f59-58725a306f55)
   - Navigate to Project Settings > Backend
   - Copy the connection details

**Important Notes:**
- The `.env` file is gitignored and should never be committed
- For production deployments, use Lovable's built-in deployment which handles environment variables automatically
- Edge functions require additional Supabase CLI setup for local testing

4. **Start the development server**
```bash
npm run dev
```

The application will be available at `http://localhost:8080`

### Local Edge Functions Development (Optional)

To test edge functions locally, you'll need the Supabase CLI:

1. **Install Supabase CLI**
```bash
npm install -g supabase
```

2. **Link to your project**
```bash
supabase link --project-ref bmjodfentjzgocqdpbje
```

3. **Start local Supabase**
```bash
supabase start
```

4. **Serve edge functions locally**
```bash
supabase functions serve
```

**Note**: Local edge function testing requires additional secrets configuration. See the [Lovable documentation](https://docs.lovable.dev/features/cloud) for details.

### Building for Production

```bash
npm run build
```

The production-ready files will be in the `dist` directory.

## 📁 Project Structure

```
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── ui/             # Shadcn/ui components
│   │   └── PdfUpload.tsx   # PDF upload component
│   ├── pages/              # Route pages
│   │   ├── Index.tsx       # Landing page
│   │   ├── Auth.tsx        # Authentication
│   │   ├── Dashboard.tsx   # Main dashboard
│   │   ├── BookDetail.tsx  # Book management
│   │   ├── Review.tsx      # Flashcard review
│   │   ├── Quiz.tsx        # MCQ quiz
│   │   └── Concepts.tsx    # Concept visualization
│   ├── integrations/       # Supabase integration
│   │   └── supabase/
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utility functions
│   └── main.tsx            # Application entry point
├── supabase/
│   ├── functions/          # Edge functions
│   │   ├── process-pdf/
│   │   ├── generate-flashcards/
│   │   ├── generate-mcq/
│   │   └── generate-concepts/
│   ├── migrations/         # Database migrations
│   └── config.toml         # Supabase configuration
└── public/                 # Static assets
```

## 🛠️ Technologies Used

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Shadcn/ui
- TanStack Query
- React Router
- Lucide Icons
- ReactFlow
- Recharts

### Backend & Infrastructure
- Lovable Cloud (Supabase)
- PostgreSQL with pgvector
- Deno Edge Functions
- Supabase Storage
- Supabase Auth

### AI & ML
- Lovable AI Gateway
- Text embeddings (vector-768)
- AI models for content generation

## 🎯 Usage

1. **Sign Up/Login**: Create an account or sign in
2. **Upload PDF**: Add your textbook PDFs from the dashboard
3. **Process Content**: Wait for AI to process and chunk the content
4. **Generate Materials**:
   - Create flashcards for specific topics
   - Generate MCQ quizzes
   - Visualize concept hierarchies
5. **Study**: Review flashcards with spaced repetition
6. **Track Progress**: Monitor your learning across all materials

## 🔒 Security

- Row Level Security (RLS) policies on all database tables
- JWT-based authentication
- Secure file storage with access controls
- Edge functions with JWT verification

## 🚢 Deployment

This project is built with Lovable and can be deployed with one click:

1. Open your project in [Lovable](https://lovable.dev)
2. Click **Publish** in the top right
3. Your app will be live at `yourapp.lovable.app`

For custom domains, navigate to Project > Settings > Domains in Lovable.

## 📝 License

This project was created with Lovable.

## 🔗 Links

- [Lovable Documentation](https://docs.lovable.dev/)
- [Project URL](https://lovable.dev/projects/453f4c28-b2c8-4b06-8f59-58725a306f55)

## 🤝 Contributing

This is a Lovable project. To contribute:
1. Make changes via Lovable editor or your local IDE
2. Push changes to GitHub (auto-syncs with Lovable)
3. Changes are automatically deployed

---

Built with ❤️ using [Lovable](https://lovable.dev)
