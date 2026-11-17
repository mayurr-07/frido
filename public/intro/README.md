# Frido intro brand loader

The intro loader displays the official Frido logo reveal on Frido's signature yellow background (`#FCD10C`):

- **Primary**: Framer Motion brand animation featuring the Frido wordmark logo reveal, taglines ("Freedom to live life your way", "Walk · Sit · Sleep"), and progress bar.
- **Fallback**: Static Frido brand logo screen if animation initialization fails.

Session-scoped (`frido_intro_seen`), with skip button, `Escape` key support, and reduced-motion awareness.
Can be replayed at any time via Settings or the Top Bar.
