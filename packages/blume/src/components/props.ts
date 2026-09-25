// Public prop types for Blume's built-in components, so users can type their
// overrides and wrappers: `import type { CalloutProps } from "blume/components"`.
//
// Each type is derived straight from the component with Astro's `ComponentProps`,
// so it can never drift from the real props. `typeof import(...)` keeps these
// type-only (no runtime import); the file-level disable is because that syntax is
// the only way to reference an `.astro` component's type without a value import.
// oxlint-disable typescript/consistent-type-imports
import type { ComponentProps } from "astro/types";

export type AccordionProps = ComponentProps<
  typeof import("./content/Accordion.astro").default
>;
export type AccordionItemProps = ComponentProps<
  typeof import("./content/AccordionItem.astro").default
>;
export type BadgeProps = ComponentProps<
  typeof import("./content/Badge.astro").default
>;
export type CalloutProps = ComponentProps<
  typeof import("./content/Callout.astro").default
>;
export type CardProps = ComponentProps<
  typeof import("./content/Card.astro").default
>;
export type CardGroupProps = ComponentProps<
  typeof import("./content/CardGroup.astro").default
>;
export type CodeGroupProps = ComponentProps<
  typeof import("./content/CodeGroup.astro").default
>;
export type ColumnProps = ComponentProps<
  typeof import("./content/Column.astro").default
>;
export type ColumnsProps = ComponentProps<
  typeof import("./content/Columns.astro").default
>;
export type ExpandableProps = ComponentProps<
  typeof import("./content/Expandable.astro").default
>;
export type FrameProps = ComponentProps<
  typeof import("./content/Frame.astro").default
>;
export type PanelProps = ComponentProps<
  typeof import("./content/Panel.astro").default
>;
export type ParamFieldProps = ComponentProps<
  typeof import("./content/ParamField.astro").default
>;
export type PromptProps = ComponentProps<
  typeof import("./content/Prompt.astro").default
>;
export type ResponseFieldProps = ComponentProps<
  typeof import("./content/ResponseField.astro").default
>;
export type StepProps = ComponentProps<
  typeof import("./content/Step.astro").default
>;
export type StepsProps = ComponentProps<
  typeof import("./content/Steps.astro").default
>;
export type TabProps = ComponentProps<
  typeof import("./content/Tab.astro").default
>;
export type TabsProps = ComponentProps<
  typeof import("./content/Tabs.astro").default
>;
export type TileProps = ComponentProps<
  typeof import("./content/Tile.astro").default
>;
export type TooltipProps = ComponentProps<
  typeof import("./content/Tooltip.astro").default
>;
export type YouTubeProps = ComponentProps<
  typeof import("./content/YouTube.astro").default
>;
export type IconProps = ComponentProps<typeof import("./Icon.astro").default>;
