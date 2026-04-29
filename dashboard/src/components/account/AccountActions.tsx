import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

export default function AccountActions() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleSignOut = () => {
    logout();
    navigate("/login");
  };

  return (
    <section className="pt-6 border-t border-neutral-800">
      <h2 className="text-lg font-medium mb-1">Actions</h2>
      <p className="text-sm text-neutral-500 mb-6">Manage your session</p>

      <div className="bg-neutral-900 border border-neutral-800 rounded p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Sign Out</div>
            <p className="text-sm text-neutral-500 mt-0.5">
              Sign out of your current session
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 text-sm text-error border border-error/30 hover:bg-error/10 hover:border-error/50 rounded transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </section>
  );
}
