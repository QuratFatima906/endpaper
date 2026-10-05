/** Joins truthy class names. Plain module so server components can call it too. */
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
