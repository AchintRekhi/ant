import { redirect } from "next/navigation";

// The Activity tab was dissolved in the nav restructure: quick-log + streak now
// live on Home, badges + goal progress on Profile. This route stays only to
// redirect any old bookmarks. (ActivityClient.tsx + actions.ts remain — Home
// imports the quick-log surface from here.)
export default function ActivityPage() {
  redirect("/app");
}
