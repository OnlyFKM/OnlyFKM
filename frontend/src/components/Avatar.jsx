export default function Avatar({ user, size = 56 }) {
  const initial = user.name?.[0]?.toUpperCase() || "?";
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        backgroundColor: user.avatarColor || "#888",
        fontSize: size * 0.4,
      }}
    >
      {initial}
    </div>
  );
}
