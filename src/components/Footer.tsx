import { Link } from "@tanstack/react-router";
import { Mark } from "./Mark";

export function Footer() {
  return (
    <footer className="gutter relative border-t border-border pb-10 pt-20">
      <div className="grid gap-12 md:grid-cols-12">
        <div className="md:col-span-5">
          <Mark className="text-2xl" />
          <p className="mt-6 max-w-xs text-muted-foreground">
            A social space for the strangely specific. Currently a working demo — nothing you do
            here leaves your browser.
          </p>
        </div>
        <nav className="md:col-span-3" aria-label="Footer">
          <p className="label-mono mb-4 text-muted-foreground">Index</p>
          <ul className="space-y-2">
            {(
              [
                ["/", "Home"],
                ["/discover", "Discover"],
                ["/constellation", "Constellation"],
                ["/communities", "Communities"],
                ["/messages", "Messages"],
                ["/login", "Login"],
              ] as const
            ).map(([to, l], i) => (
              <li key={to}>
                <Link to={to} className="group inline-flex gap-3 hover:text-signal">
                  <span className="label-mono pt-1 text-muted-foreground">0{i + 1}</span>
                  {l}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="md:col-span-4">
          <p className="label-mono mb-4 text-muted-foreground">Elsewhere (soon)</p>
          <ul className="space-y-2 text-muted-foreground">
            <li>Are.na</li>
            <li>Mastodon</li>
            <li>Newsletter</li>
          </ul>
        </div>
      </div>
      <div className="mt-24 flex flex-col justify-between gap-4 border-t border-border pt-6 md:flex-row">
        <p className="label-mono text-signal">CS / 055</p>
        <p className="label-mono text-muted-foreground">Different atoms. Unexpected bonds.</p>
        <p className="label-mono text-muted-foreground">© 2026 Cesium</p>
      </div>
      <p
        aria-hidden
        className="display text-outline pointer-events-none mt-10 select-none text-[22vw] opacity-20"
      >
        Cesium
      </p>
    </footer>
  );
}
