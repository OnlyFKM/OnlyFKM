# ¡Hola, soy Fran! 👋

Soy un apasionado de los Esports, la programación y la ciberseguridad. Actualmente, estoy en un viaje de aprendizaje constante, explorando estas áreas emocionantes. Permíteme contarte un poco más sobre mí:

## Sobre Mí

- 🎮 **Esports Enthusiast**: Los Esports son una de mis grandes pasiones. Me encanta seguir competencias, conocer a los equipos y aprender sobre estrategias de juego.

- 💻 **Aprendiz de Desarrollo**: Estoy estudiando programación en **42 Málaga Fundación Telefónica**. Me emociona explorar el mundo del desarrollo de software y aprender nuevos lenguajes y tecnologías.

- 🔒 **Entusiasta de la Ciberseguridad**: Además de la programación, estoy profundizando mis conocimientos en ciberseguridad mediante cursos por mi cuenta. La seguridad en línea es un tema crucial en el mundo actual.

## Formación

- 🎓 **Grado en Marketing e Investigación de Mercados**: Poseo un grado universitario en Marketing e Investigación de Mercados, lo que me brinda una perspectiva única en la combinación de tecnología y estrategia de mercado.

## Contacto

¡Si deseas ponerse en contacto conmigo o hablar sobre colaboraciones emocionantes, no dudes en escribirme a [fjcastillomartin@gmail.com]!

¡Gracias por visitar mi perfil de GitHub! Espero que encuentres interesantes mis proyectos y contribuciones. 😄

---

## 🚀 Proyecto: OnlyFKM

Aplicación social para conocer gente nueva y hacer amigos. Los usuarios crean un perfil, descubren a otras personas, se envían solicitudes de amistad y las aceptan o rechazan.

### Stack

- **Frontend**: React + Vite (React Router para la navegación)
- **Backend**: Node.js + Express, con los datos en memoria (sin base de datos por ahora)

### Estructura

```
backend/    API REST (Express)
frontend/   Aplicación web (React + Vite)
```

### Cómo ejecutar el proyecto

**Backend** (puerto 4000):

```bash
cd backend
npm install
npm run dev
```

**Frontend** (puerto 5173):

```bash
cd frontend
npm install
npm run dev
```

El frontend redirige las peticiones a `/api` hacia el backend (configurado en `vite.config.js`), así que basta con abrir `http://localhost:5173` una vez ambos servidores estén corriendo.

### Funcionalidades actuales

- Elegir un perfil existente o crear uno nuevo (nombre, edad, bio, intereses)
- Descubrir otros perfiles
- Enviar solicitudes de amistad
- Aceptar o rechazar solicitudes recibidas
- Ver la lista de amigos

### Próximos pasos

- Persistencia con base de datos (PostgreSQL o MongoDB)
- Autenticación real (por ahora se "entra" eligiendo un perfil, sin contraseña)
- Chat entre amigos
