import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react' // Keep this if you are using useState for 'active' tabs

// 1. Tell TanStack Router to register this file as your home path '/'
export const Route = createFileRoute('/')({
  component: IndexComponent,
})

function IndexComponent() {
  // --- PASTE ALL YOUR CURRENT VARIABLES & STATES HERE ---
  // Example: const [active, setActive] = useState(INITIAL_ID)
  // Example: const dark = true 

  return (
    <>
      {/* --- PASTE ALL OF YOUR EXISTING HTML/JSX CODE HERE --- */}
      {/* This is where your <div className="loading-tight text-left"> goes... */}
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Homepage loaded successfully.</p>
        
        {/* Your navigation menu goes right here: */}
        <nav className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
          {/* Your ORDER.map(...) loop and everything else from your screenshot */}
        </nav>
      </div>
    </>
  )
}
