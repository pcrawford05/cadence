/** Re-mounts on every navigation: a short rise-and-fade so page changes read as motion, not a cut. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
