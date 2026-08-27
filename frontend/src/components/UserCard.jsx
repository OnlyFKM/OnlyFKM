import Avatar from "./Avatar.jsx";

export default function UserCard({ user, footer }) {
  return (
    <div className="user-card">
      <Avatar user={user} />
      <div className="user-card-body">
        <h3>
          {user.name}, {user.age}
        </h3>
        <p className="bio">{user.bio}</p>
        {user.interests?.length > 0 && (
          <div className="tags">
            {user.interests.map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
        )}
        {footer}
      </div>
    </div>
  );
}
