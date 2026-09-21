// The GitHub Pages build has no server-side API route. Keep its secret-free fallback local.
export const JEV_API_ENABLED = process.env.NEXT_PUBLIC_JEV_API_ENABLED !== "false";
