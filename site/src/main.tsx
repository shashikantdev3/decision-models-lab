import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router-dom";
import "./styles/base.css";
import { LabProvider } from "./lib/mode.tsx";
import { Layout } from "./components/Layout.tsx";
import { Home } from "./pages/Home.tsx";
import { Learn } from "./pages/Learn.tsx";
import { HelloWorld } from "./pages/HelloWorld.tsx";
import { Playground } from "./pages/Playground.tsx";
import { TriageDesk } from "./pages/TriageDesk.tsx";
import { Results } from "./pages/Results.tsx";
import { Extend } from "./pages/Extend.tsx";

// Hash routing works on GitHub Pages without a 404 redirect trick.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LabProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="hello" element={<HelloWorld />} />
            <Route path="learn" element={<Learn />} />
            <Route path="playground" element={<Playground />} />
            <Route path="desk" element={<TriageDesk />} />
            <Route path="results" element={<Results />} />
            <Route path="extend" element={<Extend />} />
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
      </HashRouter>
    </LabProvider>
  </StrictMode>,
);
