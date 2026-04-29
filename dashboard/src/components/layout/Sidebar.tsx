import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useProject } from "../../hooks/useProject";

const navItems = [
  {
    to: "/dashboard",
    label: "Overview",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    to: "/dashboard/traces",
    label: "Traces",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          d="M4 6h16M4 12h16M4 18h7"
        />
      </svg>
    ),
  },
  {
    to: "/dashboard/sessions",
    label: "Sessions",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
        />
      </svg>
    ),
  },
  {
    to: "/dashboard/analytics",
    label: "Analytics",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
  },
];

const settingsItems = [
  {
    to: "/dashboard/api-keys",
    label: "API Keys",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
        />
      </svg>
    ),
  },
  {
    to: "/dashboard/settings",
    label: "Settings",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  },
];

export function Sidebar() {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const { projects, selectedProject, setSelectedProject } = useProject();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const userInitial =
    user?.name?.charAt(0)?.toUpperCase() ||
    user?.email?.charAt(0)?.toUpperCase() ||
    "U";
  const displayName = user?.name || user?.email || "User";

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `relative flex items-center gap-2.5 px-2 py-1.5 text-sm rounded transition-colors ${
      isActive
        ? "text-white bg-accent/10 before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-0.5 before:h-4 before:bg-accent before:rounded-r"
        : "text-neutral-400 hover:text-white hover:bg-neutral-850"
    }`;

  return (
    <aside className="w-56 h-full border-r border-neutral-800 flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-neutral-800">
        <NavLink
          to="/dashboard"
          className="font-semibold text-sm text-neutral-100"
        >
          Pulse
        </NavLink>
      </div>

      {/* Project Selector */}
      <div className="px-3 py-3 border-b border-neutral-800 relative">
        <button
          onClick={() => setProjectMenuOpen(!projectMenuOpen)}
          className="w-full flex items-center justify-between px-2 py-1.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-850 rounded transition-colors"
        >
          <span className="truncate">
            {selectedProject?.name || "No project"}
          </span>
          <svg
            className="w-4 h-4 text-neutral-500 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              d="M8 9l4-4 4 4m0 6l-4 4-4-4"
            />
          </svg>
        </button>
        {projectMenuOpen && (
          <div className="absolute left-3 right-3 top-full mt-1 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl overflow-hidden z-50">
            <div className="py-1">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => {
                    setSelectedProject(project);
                    setProjectMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm ${
                    selectedProject?.id === project.id
                      ? "text-white bg-accent/10"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-850"
                  }`}
                >
                  {project.name}
                </button>
              ))}
              {projects.length === 0 && (
                <div className="px-3 py-2 text-sm text-neutral-500">
                  No projects yet
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 px-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={navLinkClass}
            end={item.to === "/dashboard"}
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}

        <div className="mt-4 mb-1 px-2">
          <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-medium">
            Settings
          </span>
        </div>
        {settingsItems.map((item) => (
          <NavLink key={item.to} to={item.to} className={navLinkClass}>
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User Menu */}
      <div className="p-3 border-t border-neutral-800 relative">
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-neutral-400 hover:text-white hover:bg-neutral-850 rounded transition-colors"
        >
          <div className="w-6 h-6 bg-neutral-700 flex items-center justify-center text-xs font-medium text-neutral-300">
            {userInitial}
          </div>
          <span className="truncate flex-1 text-left">{displayName}</span>
          <svg
            className="w-4 h-4 text-neutral-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              d="M8 9l4-4 4 4m0 6l-4 4-4-4"
            />
          </svg>
        </button>

        {userMenuOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-1 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl overflow-hidden z-50">
            <div className="py-1">
              <NavLink
                to="/dashboard/account"
                onClick={() => setUserMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-400 hover:text-white hover:bg-neutral-850"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                Account
              </NavLink>
            </div>
            <div className="border-t border-neutral-800 py-1">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-400/80 hover:text-rose-400 hover:bg-rose-500/5 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
