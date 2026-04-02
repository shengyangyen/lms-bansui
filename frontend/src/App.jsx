import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './store';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import CourseDetail from './pages/CourseDetail';
import AdminPanel from './pages/AdminPanel';
import ManageMaterials from './pages/ManageMaterials';
import CourseMaterialsList from './pages/CourseMaterialsList';
import CourseAssignmentsList from './pages/CourseAssignmentsList';
import AssignmentManagement from './pages/AssignmentManagement';
import EditAssignment from './pages/EditAssignment';
import GradingPage from './pages/GradingPage';
import SubmitAssignment from './pages/SubmitAssignment';
import AssignmentFeedback from './pages/AssignmentFeedback';
import AssignmentStatistics from './pages/AssignmentStatistics';
import FeaturedSubmissions from './pages/FeaturedSubmissions';
import Leaderboard from './pages/Leaderboard';

function App() {
  const token = useStore((state) => state.token);
  const user = useStore((state) => state.user);
  const isAdmin = user?.user_role === 'admin';
  const isTeacher = user?.user_role === 'instructor';

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!token ? <Login /> : <Navigate to="/" />} />
        <Route path="/register" element={!token ? <Register /> : <Navigate to="/" />} />
        <Route path="/" element={token ? <Dashboard /> : <Navigate to="/login" />} />
        <Route path="/course/:id" element={token ? <CourseDetail /> : <Navigate to="/login" />} />
        
        {/* Admin 專用路由 */}
        <Route path="/admin" element={token && isAdmin ? <AdminPanel /> : <Navigate to="/" />} />
        <Route path="/admin/materials" element={token && isAdmin ? <CourseMaterialsList /> : <Navigate to="/" />} />
        <Route path="/admin/materials/:courseId" element={token && isAdmin ? <ManageMaterials /> : <Navigate to="/" />} />
        <Route path="/admin/assignments" element={token && isAdmin ? <CourseAssignmentsList /> : <Navigate to="/" />} />
        <Route path="/admin/assignments/:courseId" element={token && isAdmin ? <AssignmentManagement /> : <Navigate to="/" />} />
        <Route path="/admin/submissions/:submissionId/feedback" element={token && isAdmin ? <GradingPage /> : <Navigate to="/" />} />
        
        {/* 導師專用路由 */}
        <Route path="/teacher/assignments" element={token && isTeacher ? <CourseAssignmentsList /> : <Navigate to="/" />} />
        <Route path="/teacher/assignments/:courseId" element={token && isTeacher ? <AssignmentManagement /> : <Navigate to="/" />} />
        <Route path="/teacher/materials" element={token && isTeacher ? <CourseMaterialsList /> : <Navigate to="/" />} />
        <Route path="/teacher/materials/:courseId" element={token && isTeacher ? <ManageMaterials /> : <Navigate to="/" />} />
        
        {/* 其他路由 */}
        <Route path="/assignments/:assignmentId/edit" element={token ? <EditAssignment /> : <Navigate to="/login" />} />
        <Route path="/assignments/:assignmentId/submit" element={token ? <SubmitAssignment /> : <Navigate to="/login" />} />
        <Route path="/assignment-feedback/:submissionId" element={token ? <AssignmentFeedback /> : <Navigate to="/login" />} />
        <Route path="/assignments/:assignmentId/statistics" element={token ? <AssignmentStatistics /> : <Navigate to="/login" />} />
        <Route path="/courses/:courseId/featured-submissions" element={token ? <FeaturedSubmissions /> : <Navigate to="/login" />} />
        <Route path="/leaderboard" element={token ? <Leaderboard /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
