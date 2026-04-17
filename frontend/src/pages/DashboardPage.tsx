import { useNavigate } from "react-router";
import { useMe, useLogout } from "@/hooks/useAuth";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: user, isLoading } = useMe();
  const logout = useLogout();

  const handleLogout = async () => {
    await logout.mutateAsync();
    navigate("/login");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-md p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-red-600 transition-colors"
            >
              Sign out
            </button>
          </div>
          <div className="space-y-3">
            <p className="text-gray-700">
              <span className="font-medium">Name:</span> {user?.name}
            </p>
            <p className="text-gray-700">
              <span className="font-medium">Email:</span> {user?.email}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
