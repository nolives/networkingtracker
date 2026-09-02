/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public by design: the Managed Better Auth endpoint the browser talks to. */
  readonly VITE_NEON_AUTH_URL: string;
  /**
   * Public by design. Declared for parity with the assignment's variable list
   * and used by scripts/rls-two-user-test.mjs, which attacks this very URL to
   * prove RLS holds. The app itself does not query the Data API from the
   * browser -- contact data goes through the Node backend.
   */
  readonly VITE_NEON_DATA_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
