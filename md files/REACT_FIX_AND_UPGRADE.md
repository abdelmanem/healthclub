## React context error fix and React 19 upgrade path

### What was fixed
- Aligned the frontend to React 18 compatible with CRA 5 to resolve runtime context errors.
  - react: 18.3.1
  - react-dom: 18.3.1
  - @types/react: 18.x
  - @types/react-dom: 18.x
  - @testing-library/react: 14.x
- Reinstalled dependencies and built successfully.
- Replaced MUI icons named imports with per-icon default imports to fix build errors.
  - Example: `import Close from '@mui/icons-material/Close'`
  - Updated files included: `LogoutButton.tsx`, `EnhancedDialog.tsx`, `EnhancedTable.tsx`, `ToastProvider.tsx`, `Layout.tsx`, `ConfigurationForm.tsx`, `ConfigurationManager.tsx`, `CancellationReasonForm.tsx`, `ErrorBoundary.tsx`, `GuestProfile.tsx`.

### Why this fixed the issue
- CRA 5 is not compatible with React 19 in practice (module interop can break hooks like useContext). Pinning to React 18 removes the interop mismatch, and correcting MUI icon imports avoids missing export errors.

### Verify current versions
Run:
```bash
npm ls react react-dom @types/react @types/react-dom --depth=0
```
Expected:
```
react@18.3.1
react-dom@18.3.1
@types/react@18.x
@types/react-dom@18.x
```

---

## Recommended upgrade path to React 19

React 19 with CRA 5 is brittle. Migrate off CRA first (to Vite), then bump to React 19.

### 1) Migrate CRA → Vite (stay on React 18)
1. Install dev deps:
   ```bash
   npm i -D vite @vitejs/plugin-react-swc cross-env
   ```
2. Add scripts in `package.json`:
   ```json
   {
     "scripts": {
       "dev": "vite",
       "build": "vite build",
       "preview": "vite preview"
     }
   }
   ```
3. Create `vite.config.ts`:
   ```ts
   import { defineConfig } from 'vite';
   import react from '@vitejs/plugin-react-swc';

   export default defineConfig({
     plugins: [react()],
     server: { port: 3000 },
     // add resolve.alias if you use path aliases
   });
   ```
4. Move CRA `public/index.html` to project root as `index.html` (Vite root). Ensure it contains `<div id="root"></div>` and loads `/src/index.tsx`.
5. Replace `process.env` usage with `import.meta.env` and prefix env vars with `VITE_`.
6. Ensure `tsconfig.json` has `"jsx": "react-jsx"`.
7. Run and verify:
   ```bash
   npm run dev
   npm run build
   ```

### 2) Upgrade to React 19
1. Bump versions:
   ```bash
   npm i -S react@^19 react-dom@^19
   npm i -D @types/react@^19 @types/react-dom@^19 typescript@^5.4
   ```
2. Testing libs (React 19 compatible):
   ```bash
   npm i -D @testing-library/react@^16 @testing-library/dom@^10 @testing-library/jest-dom@^6
   ```
3. Ensure peers are compatible/up-to-date:
   - `react-router-dom@^7`
   - `@mui/material@^5` (OK)
   - `@reduxjs/toolkit@^2`
4. Run and build:
   ```bash
   npm run dev
   npm run build
   ```
5. Fix any TS/lint issues that surface.

### Notes
- If you must try React 19 on CRA 5, expect bundler/interop issues (not recommended). Vite migration first is the clean, stable route.


