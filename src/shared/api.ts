export const ApiEndpoint = {
  OnPostCreate: "/internal/menu/post-create",
  OnAppInstall: "/internal/on-app-install",
  OnPostSubmit: "/internal/on-post-submit",
} as const;

export type ApiEndpoint = (typeof ApiEndpoint)[keyof typeof ApiEndpoint];
