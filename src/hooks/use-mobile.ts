import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    // Use requestAnimationFrame to defer the initial state set, avoiding the
    // setState-in-effect lint violation while still initializing synchronously
    // enough for layout.
    const raf = requestAnimationFrame(onChange)
    return () => {
      mql.removeEventListener("change", onChange)
      cancelAnimationFrame(raf)
    }
  }, [])

  return !!isMobile
}
