import { Routes, Route, Navigate } from "react-router-dom";
import { SplashScreen } from "./components/SplashScreen";
import { CaregiverLayout } from "./layouts/CaregiverLayout";
import { ManagerLayout } from "./layouts/ManagerLayout";
import { Landing } from "./pages/Landing";
import { Welcome } from "./pages/caregiver/Welcome";
import { Connect } from "./pages/caregiver/Connect";
import { CheckIn } from "./pages/caregiver/CheckIn";
import { Today } from "./pages/caregiver/Today";
import { HeadsUp } from "./pages/caregiver/HeadsUp";
import { Privacy } from "./pages/caregiver/Privacy";
import { Cohort } from "./pages/manager/Cohort";
import { Load } from "./pages/manager/Load";
import { Methods } from "./pages/Methods";

export function App() {
  return (
    <>
      <SplashScreen />
      <Routes>
      <Route path="/" element={<Landing />} />

      <Route path="/app" element={<CaregiverLayout />}>
        <Route index element={<Today />} />
        <Route path="welcome" element={<Welcome />} />
        <Route path="connect" element={<Connect />} />
        <Route path="checkin" element={<CheckIn />} />
        <Route path="headsup" element={<HeadsUp />} />
        <Route path="privacy" element={<Privacy />} />
      </Route>

      <Route path="/dashboard" element={<ManagerLayout />}>
        <Route index element={<Cohort />} />
        <Route path="load" element={<Load />} />
      </Route>

      <Route path="/methods" element={<Methods />} />
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
