// Hardcoded, per-person notification theming. Right now there are only two
// users: the husband (Olivier) and his wife. This decides which icon shows and
// whether the message is disguised. See the README "Personalized notifications".

export interface NotificationView {
  title: string;
  body: string;
  icon: string;
  badge: string;
}

// Who counts as "the husband". Matched case-insensitively against the member's
// display name. Override with the HUSBAND_NAME env var if the name differs.
const HUSBAND_NAME = (process.env.HUSBAND_NAME ?? "Olivier").trim().toLowerCase();

const ICONS = {
  default: "/icons/icon-192.png",
  flashy: "/icons/flashy-192.png",
  instagram: "/icons/instagram-192.png",
};

// "My beloved husband" in Russian — the disguised "sender" shown to his wife.
const BELOVED_HUSBAND_RU = "Мой любимый муж";

function isHusband(name?: string | null): boolean {
  return !!name && name.trim().toLowerCase() === HUSBAND_NAME;
}

export function themeNotification(base: {
  title: string;
  body: string;
  senderName?: string | null;
  recipientName?: string | null;
}): NotificationView {
  // 1) The husband gets a bold, unmistakable icon on everything he receives.
  if (isHusband(base.recipientName)) {
    return {
      title: base.title,
      body: base.body,
      icon: ICONS.flashy,
      badge: ICONS.flashy,
    };
  }
  // 2) Anything the husband sends is disguised as an Instagram notification
  //    from an account named "Мой любимый муж".
  if (isHusband(base.senderName)) {
    return {
      title: BELOVED_HUSBAND_RU,
      body: base.body,
      icon: ICONS.instagram,
      badge: ICONS.instagram,
    };
  }
  // 3) Everyone else / system nudges use the plain app icon.
  return {
    title: base.title,
    body: base.body,
    icon: ICONS.default,
    badge: ICONS.default,
  };
}
