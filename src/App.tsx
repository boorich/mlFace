import React from "react";
import { Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./components/theme/theme-provider";
import { MainLayout } from "./components/layout/main-layout";

function App() {
  return (
    <ThemeProvider>
      <Routes>
        <Route path="/" element={<MainLayout />} />
      </Routes>
    </ThemeProvider>
  );
}

export default App;