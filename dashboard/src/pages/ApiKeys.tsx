import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import ApiKeyList, { type ApiKey } from "../components/api-keys/ApiKeyList";
import CreateApiKeyModal from "../components/api-keys/CreateApiKeyModal";
import {
  type CreateProjectUserInput,
  type ProjectUserInfo,
} from "../lib/apiClient";
import {
  useApiKeysQuery,
  useCreateProjectUserMutation,
  useDeleteApiKeyMutation,
  useProjectUsersQuery,
  useUpdateApiKeyNameMutation,
} from "../api";
import { useProject } from "../hooks/useProject";

const PlusIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 4v16m8-8H4"
    />
  </svg>
);

const InfoIcon = () => (
  <svg
    className="w-5 h-5 text-accent flex-shrink-0 mt-0.5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

export default function ApiKeys() {
  const { selectedProject } = useProject();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState<string | null>(null);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);
  const [newUser, setNewUser] = useState<{
    name: string;
    email: string;
    password: string;
    role: "admin" | "user";
  }>({
    name: "",
    email: "",
    password: "",
    role: "user",
  });

  const apiKeysQuery = useApiKeysQuery(selectedProject?.id);
  const usersQuery = useProjectUsersQuery(selectedProject?.id);
  const deleteApiKeyMutation = useDeleteApiKeyMutation(selectedProject?.id);
  const createUserMutation = useCreateProjectUserMutation(selectedProject?.id);
  const updateApiKeyNameMutation = useUpdateApiKeyNameMutation(
    selectedProject?.id,
  );

  const keys: ApiKey[] = useMemo(() => {
    return (apiKeysQuery.data?.keys ?? []).map((k) => ({
      id: k.id,
      name: k.name,
      key: k.key,
      created_at: k.createdAt,
      last_used_at: k.lastUsedAt,
      status: k.lastUsedAt ? ("active" as const) : ("never_used" as const),
    }));
  }, [apiKeysQuery.data]);

  const users: ProjectUserInfo[] = usersQuery.data?.users ?? [];

  const error =
    apiKeysQuery.error instanceof Error ? apiKeysQuery.error.message : null;
  const usersError =
    usersQuery.error instanceof Error ? usersQuery.error.message : null;

  const resetCreateUserState = () => {
    setCreateUserError(null);
    setNewUser({
      name: "",
      email: "",
      password: "",
      role: "user",
    });
  };

  const handleKeyCreated = () => {
    queryClient.invalidateQueries({
      queryKey: ["api-keys", selectedProject?.id],
    });
  };

  const handleRevokeKey = async (keyId: string) => {
    try {
      await deleteApiKeyMutation.mutateAsync(keyId);
    } catch (err) {
      console.error("Failed to revoke key:", err);
    }
    setShowRevokeModal(null);
  };

  const handleCopyKey = async (keyValue: string) => {
    await navigator.clipboard.writeText(keyValue);
  };

  const handleNameChange = async (keyId: string, newName: string) => {
    try {
      await updateApiKeyNameMutation.mutateAsync({ keyId, name: newName });
    } catch (err) {
      console.error("Failed to update key name:", err);
    }
  };

  const handleCreateUser = async () => {
    setCreateUserError(null);

    try {
      const payload: CreateProjectUserInput = {
        email: newUser.email.trim(),
        role: newUser.role,
      };

      if (newUser.name.trim()) {
        payload.name = newUser.name.trim();
      }
      if (newUser.password.trim()) {
        payload.password = newUser.password;
      }

      await createUserMutation.mutateAsync(payload);
      setShowCreateUserModal(false);
      resetCreateUserState();
    } catch (err) {
      setCreateUserError(
        err instanceof Error ? err.message : "Failed to create user",
      );
    }
  };

  const keyToRevoke = keys.find((k) => k.id === showRevokeModal);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-14 flex items-center justify-between px-6 border-b border-neutral-800 flex-shrink-0 bg-neutral-950">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-medium">API Keys</h1>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-accent hover:bg-accent/90 rounded transition-colors"
        >
          <PlusIcon />
          Create Key
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-4xl mx-auto">
          <div className="bg-accent/5 border border-accent/20 rounded p-4 mb-6">
            <div className="flex gap-3">
              <InfoIcon />
              <div>
                <p className="text-sm text-neutral-300">
                  API keys are used to authenticate requests to the Pulse API.
                  Keep your keys secure and never share them publicly.
                </p>
                <a
                  href="#"
                  className="text-sm text-accent hover:underline mt-1 inline-block"
                >
                  View API documentation
                </a>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-error/5 border border-error/20 rounded p-4 mb-6">
              <div className="flex gap-3">
                <svg
                  className="w-5 h-5 text-error flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <div>
                  <p className="text-sm text-error">{error}</p>
                  <button
                    onClick={() => apiKeysQuery.refetch()}
                    className="text-sm text-accent hover:underline mt-1 inline-block"
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          )}

          <ApiKeyList
            keys={keys}
            loading={apiKeysQuery.isPending}
            onCreateClick={() => setShowCreateModal(true)}
            onCopyKey={handleCopyKey}
            onRevokeKey={(keyId) => setShowRevokeModal(keyId)}
            onNameChange={handleNameChange}
          />

          <section className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium">Users</h2>
              <button
                onClick={() => {
                  resetCreateUserState();
                  setShowCreateUserModal(true);
                }}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-white bg-accent hover:bg-accent/90 rounded transition-colors"
              >
                <PlusIcon />
                Add User
              </button>
            </div>

            {usersError && (
              <div className="bg-error/5 border border-error/20 rounded p-4 mb-4">
                <p className="text-sm text-error">{usersError}</p>
                <button
                  onClick={() => usersQuery.refetch()}
                  className="text-sm text-accent hover:underline mt-1 inline-block"
                >
                  Retry
                </button>
              </div>
            )}

            <div className="border border-neutral-800 rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-neutral-900/80 border-b border-neutral-800">
                  <tr className="text-left text-neutral-400">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {usersQuery.isPending && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-neutral-500"
                      >
                        Loading users...
                      </td>
                    </tr>
                  )}
                  {!usersQuery.isPending && users.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-neutral-500"
                      >
                        No users in this project yet.
                      </td>
                    </tr>
                  )}
                  {!usersQuery.isPending &&
                    users.map((projectUser) => (
                      <tr
                        key={projectUser.userId}
                        className="border-t border-neutral-800"
                      >
                        <td className="px-4 py-3 text-neutral-200">
                          {projectUser.name}
                        </td>
                        <td className="px-4 py-3 text-neutral-300">
                          {projectUser.email}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded px-2 py-0.5 text-xs bg-neutral-800 text-neutral-300">
                            {projectUser.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-neutral-400">
                          {new Date(projectUser.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      <CreateApiKeyModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onKeyCreated={handleKeyCreated}
      />

      {showRevokeModal && keyToRevoke && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
              <h3 className="text-sm font-medium">Revoke API Key</h3>
              <button
                onClick={() => setShowRevokeModal(null)}
                className="p-1 hover:bg-neutral-800 rounded"
              >
                <svg
                  className="w-4 h-4 text-neutral-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <div className="bg-error/5 border border-error/20 rounded p-3 mb-4">
                <div className="flex gap-2">
                  <svg
                    className="w-4 h-4 text-error flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <p className="text-xs text-error">
                    This action cannot be undone. Any applications using this
                    key will stop working.
                  </p>
                </div>
              </div>
              <p className="text-sm text-neutral-400">
                Are you sure you want to revoke{" "}
                <span className="text-white font-medium">
                  {keyToRevoke.name}
                </span>
                ?
              </p>
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-neutral-800">
              <button
                onClick={() => setShowRevokeModal(null)}
                className="px-4 py-2 text-sm text-neutral-400 border border-neutral-700 hover:bg-neutral-850 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRevokeKey(keyToRevoke.id)}
                className="px-4 py-2 text-sm text-white bg-error hover:bg-error/80 rounded transition-colors"
              >
                Revoke Key
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateUserModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
              <h3 className="text-sm font-medium">Add User to Project</h3>
              <button
                onClick={() => setShowCreateUserModal(false)}
                className="p-1 hover:bg-neutral-800 rounded"
              >
                <svg
                  className="w-4 h-4 text-neutral-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs text-neutral-400 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) =>
                    setNewUser((prev) => ({
                      ...prev,
                      email: e.currentTarget.value,
                    }))
                  }
                  className="w-full px-3 py-2 text-sm bg-neutral-950 border border-neutral-700 rounded focus:border-accent focus:outline-none"
                  placeholder="user@company.com"
                />
              </div>

              <div>
                <label className="block text-xs text-neutral-400 mb-1">
                  Name (required for new users)
                </label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) =>
                    setNewUser((prev) => ({
                      ...prev,
                      name: e.currentTarget.value,
                    }))
                  }
                  className="w-full px-3 py-2 text-sm bg-neutral-950 border border-neutral-700 rounded focus:border-accent focus:outline-none"
                  placeholder="Jane Doe"
                />
              </div>

              <div>
                <label className="block text-xs text-neutral-400 mb-1">
                  Password (required for new users)
                </label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) =>
                    setNewUser((prev) => ({
                      ...prev,
                      password: e.currentTarget.value,
                    }))
                  }
                  className="w-full px-3 py-2 text-sm bg-neutral-950 border border-neutral-700 rounded focus:border-accent focus:outline-none"
                  placeholder="At least 8 characters"
                />
              </div>

              <div>
                <label className="block text-xs text-neutral-400 mb-1">
                  Role
                </label>
                <select
                  value={newUser.role}
                  onChange={(e) =>
                    setNewUser((prev) => ({
                      ...prev,
                      role: e.currentTarget.value as "admin" | "user",
                    }))
                  }
                  className="w-full px-3 py-2 text-sm bg-neutral-950 border border-neutral-700 rounded focus:border-accent focus:outline-none"
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </div>

              <p className="text-xs text-neutral-500">
                If the email already exists, this adds that account to the
                selected project.
              </p>

              {createUserError && (
                <div className="bg-error/5 border border-error/20 rounded p-3">
                  <p className="text-xs text-error">{createUserError}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 px-4 py-3 border-t border-neutral-800">
              <button
                onClick={() => setShowCreateUserModal(false)}
                className="px-4 py-2 text-sm text-neutral-400 border border-neutral-700 hover:bg-neutral-850 rounded transition-colors"
                disabled={createUserMutation.isPending}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateUser}
                className="px-4 py-2 text-sm text-white bg-accent hover:bg-accent/90 rounded transition-colors disabled:opacity-50"
                disabled={createUserMutation.isPending}
              >
                {createUserMutation.isPending ? "Adding..." : "Add User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
