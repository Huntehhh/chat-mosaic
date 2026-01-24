/**
 * Shared animation variants for framer-motion
 * Used across all animated components for consistency
 */
import type { Variants, Transition } from 'framer-motion';

// ============================================================================
// Transition Presets
// ============================================================================

export const springTransition: Transition = {
  type: 'spring',
  damping: 25,
  stiffness: 300,
};

export const smoothTransition: Transition = {
  duration: 0.2,
  ease: 'easeOut',
};

export const gentleTransition: Transition = {
  duration: 0.15,
  ease: 'easeOut',
};

// ============================================================================
// Fade Variants
// ============================================================================

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 10 },
};

// ============================================================================
// Slide Variants
// ============================================================================

export const slideUp: Variants = {
  initial: { y: 20, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: 20, opacity: 0 },
};

export const slideFromRight: Variants = {
  initial: { x: '100%' },
  animate: { x: 0 },
  exit: { x: '100%' },
};

export const slideFromBottom: Variants = {
  initial: { y: 100, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: 100, opacity: 0 },
};

// ============================================================================
// Modal Variants
// ============================================================================

export const modalVariants: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

export const backdropVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

// ============================================================================
// Pulse / Status Variants
// ============================================================================

export const pulseVariants: Variants = {
  animate: {
    opacity: [1, 0.5, 1],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

export const statusPulseVariants: Variants = {
  animate: {
    opacity: [1, 0.3, 1],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

export const subtlePulseVariants: Variants = {
  animate: {
    opacity: [1, 0.7, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// ============================================================================
// Thinking / Processing Variants
// ============================================================================

export const thinkingPulseVariants: Variants = {
  animate: {
    opacity: [0.5, 1, 0.5],
    scale: [0.98, 1, 0.98],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// ============================================================================
// Spin Variants
// ============================================================================

export const spinVariants: Variants = {
  animate: {
    rotate: 360,
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

// ============================================================================
// Stagger Children (for lists)
// ============================================================================

export const staggerContainer: Variants = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

// ============================================================================
// Expand/Collapse
// ============================================================================

export const expandVariants: Variants = {
  collapsed: { height: 0, opacity: 0 },
  expanded: { height: 'auto', opacity: 1 },
};

// ============================================================================
// Blink (for cursor)
// ============================================================================

export const blinkVariants: Variants = {
  animate: {
    opacity: [1, 0],
    transition: {
      duration: 0.8,
      repeat: Infinity,
      ease: 'steps(2)',
    },
  },
};
