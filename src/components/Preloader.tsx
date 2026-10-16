import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

/** ~1.3s opening sequence, once per browser session. Never blocks input. */
export function Preloader() {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || sessionStorage.getItem("cs-intro")) {
      setShow(false);
      return;
    }
    sessionStorage.setItem("cs-intro", "1");
    const t = setTimeout(() => setShow(false), 1300);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="pre"
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center bg-background"
          exit={{ clipPath: "inset(50% 0 50% 0)" }}
          initial={{ clipPath: "inset(0% 0 0% 0)" }}
          transition={{ duration: 0.55, ease: [0.76, 0, 0.24, 1] }}
        >
          <div className="relative h-24 w-[min(520px,80vw)]">
            <motion.div
              className="absolute left-1/2 top-1/2 h-px -translate-y-1/2 bg-muted-foreground/40"
              initial={{ width: 0, x: "-50%" }}
              animate={{ width: "100%", x: "-50%" }}
              transition={{ delay: 0.25, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            />
            <motion.div
              className="absolute top-1/2 h-px -translate-y-1/2 bg-signal"
              style={{ left: 0 }}
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ delay: 0.35, duration: 0.9, ease: "easeInOut" }}
            />
            {[-1, 1].map((d) => (
              <motion.span
                key={d}
                className="absolute left-1/2 top-1/2 -ml-1 -mt-1 h-2 w-2 rounded-full bg-signal"
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.6, 1, 1, 1], x: [0, 0, 0, d * 34, 0] }}
                transition={{ duration: 0.9, times: [0, 0.15, 0.28, 0.75, 1] }}
              />
            ))}
            <motion.p
              className="label-mono absolute left-0 top-0 text-muted-foreground"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              CS / 055
            </motion.p>
            <motion.p
              className="label-mono absolute bottom-0 right-0 text-foreground"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              Establishing connection
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
