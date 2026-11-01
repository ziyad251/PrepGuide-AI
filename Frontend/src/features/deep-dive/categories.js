/** Deep-dive interview categories, mirrored from the backend DEEP_DIVE_CATEGORIES enum. */
export const CATEGORIES = [
    { id: "architecture", label: "Architecture" },
    { id: "technology_choices", label: "Technology choices" },
    { id: "database_design", label: "Database design" },
    { id: "api_design", label: "API design" },
    { id: "auth_security", label: "Auth & security" },
    { id: "performance", label: "Performance" },
    { id: "scalability", label: "Scalability" },
    { id: "error_handling", label: "Error handling" },
    { id: "real_world_scenarios", label: "Real-world scenarios" },
]

const LABELS = Object.fromEntries(CATEGORIES.map((category) => [category.id, category.label]))

export const categoryLabel = (id) => LABELS[id] || id
