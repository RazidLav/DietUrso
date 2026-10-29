export type AccessRole = "user" | "admin";

export type AccessProfile = {
  userId: string | null;
  email: string | null;
  role: AccessRole;
  authenticated: boolean;
};

export type AppEventStatus = "draft" | "published" | "archived";

export type AppEvent = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  accentColor: string;
  ctaLabel: string | null;
  ctaRoute: string | null;
  status: AppEventStatus;
  createdAt: string;
  updatedAt: string;
};

export type AppEventInput = Omit<AppEvent, "id" | "createdAt" | "updatedAt">;

export type AppConfig = {
  brandAccent: string;
  announcementMessage: string;
};

export const DEFAULT_APP_CONFIG: AppConfig = {
  brandAccent: "#B7FF2A",
  announcementMessage: "",
};
