import { createRoot } from "react-dom/client";
import Game from "./components/Game";
import "./app/globals.css";

const root = document.getElementById("root");
if (!root) throw new Error("Game root was not found");
createRoot(root).render(<Game />);
