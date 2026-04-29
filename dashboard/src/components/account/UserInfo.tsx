interface UserInfoProps {
  name: string;
  email: string;
}

export default function UserInfo({ name, email }: UserInfoProps) {
  const initial = name
    ? name.charAt(0).toUpperCase()
    : email.charAt(0).toUpperCase();

  return (
    <section className="mb-10">
      <h2 className="text-lg font-medium mb-1">Profile</h2>
      <p className="text-sm text-neutral-500 mb-6">Your personal information</p>

      <div className="space-y-6">
        {/* Avatar */}
        <div>
          <label className="block text-sm font-medium mb-3">Avatar</label>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-xl font-semibold text-white">
              {initial}
            </div>
            <div>
              <div className="text-sm font-medium text-neutral-100">
                {name || "User"}
              </div>
              <div className="text-sm text-neutral-500">{email}</div>
            </div>
          </div>
        </div>

        {/* Full Name */}
        <div>
          <label className="block text-sm font-medium mb-2">Full Name</label>
          <input
            type="text"
            value={name}
            readOnly
            className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm text-neutral-500 cursor-not-allowed"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium mb-2">Email</label>
          <input
            type="email"
            value={email}
            readOnly
            className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm text-neutral-500 cursor-not-allowed"
          />
        </div>
      </div>
    </section>
  );
}
