import { ImageResponse } from "next/og";
import { getProfile, getShelf } from "./data";

// Link preview for a public profile: name and shelf size on the paper-and-ink palette (light theme; images can't follow it).
// ponytail: built-in sans font, not Newsreader; ship a Newsreader .ttf and pass it in `fonts` if the preview should be serif.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Reading shelf on Endpaper";

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const p = await getProfile((await params).username);
  const { books } = await getShelf(p.id);
  const count = books.length ? `${books.length} ${books.length === 1 ? "book" : "books"} shared` : "Reading shelf";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 80, background: "#faf9f6", color: "#1b1d22" }}>
        <div style={{ fontSize: 32, color: "#2a4bb5" }}>Endpaper</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 88, lineHeight: 1.05 }}>{p.display_name || `@${p.username}`}</div>
          <div style={{ fontSize: 36, color: "#5b606a" }}>{p.display_name ? `@${p.username} · ${count}` : count}</div>
        </div>
      </div>
    ),
    size,
  );
}
