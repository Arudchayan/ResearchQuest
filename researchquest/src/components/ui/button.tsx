import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control text-sm font-medium transition-colors focus-visible:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary-500 text-bg-base shadow-sm hover:bg-primary-600",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive-hover",
        outline:
          "border border-border-moderate bg-bg-surface text-text-primary shadow-sm hover:bg-bg-elevated",
        secondary:
          "bg-bg-elevated text-text-primary shadow-sm hover:bg-primary-100",
        ghost: "text-text-primary hover:bg-bg-elevated",
        link: "text-primary-500 underline-offset-4 hover:text-primary-600 hover:underline",
      },
      size: {
        default: "h-9 min-h-11 px-4 py-2 md:min-h-0",
        sm: "h-8 min-h-11 rounded-control px-3 text-xs md:min-h-0",
        lg: "h-10 min-h-11 rounded-control px-8 md:min-h-0",
        icon: "h-9 min-h-11 min-w-11 w-9 md:min-h-0 md:min-w-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
