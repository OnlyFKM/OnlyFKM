import Avatar from "../components/Avatar.jsx";

export default function Profile({ currentUser }) {
  return (
    <div className="page">
      <h1>Mi perfil</h1>
      <div className="profile-view">
        <Avatar user={currentUser} size={96} />
        <h2>
          {currentUser.name}, {currentUser.age}
        </h2>
        <p className="bio">{currentUser.bio || "Todavía no has añadido una biografía."}</p>
        {currentUser.interests?.length > 0 && (
          <div className="tags">
            {currentUser.interests.map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
