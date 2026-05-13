<script lang="ts">
  interface Props {
    width?: number | string;
    height?: number | string;
    title?: string;
  }
  let { width = 32, height = 32, title }: Props = $props();
</script>

<!--
  QR identity mark.
  Three position-finder squares (top-left, top-right, bottom-left) like a real
  QR code, plus a few data-cell pixels in the lower-right quadrant for body.
  All on a 24x24 grid using currentColor — inherits from surrounding text.
-->
<svg
  {width}
  {height}
  viewBox="0 0 24 24"
  fill="currentColor"
  role={title ? 'img' : 'presentation'}
  aria-label={title ?? undefined}
  aria-hidden={title ? undefined : 'true'}
  xmlns="http://www.w3.org/2000/svg"
>
  <!-- Position finder: top-left (7x7 outer, 3x3 inner) -->
  <path
    d="M0 0h9v9H0V0Zm2 2v5h5V2H2Zm1 1h3v3H3V3Z"
    fill-rule="evenodd"
    clip-rule="evenodd"
  />
  <!-- Position finder: top-right -->
  <path
    d="M15 0h9v9h-9V0Zm2 2v5h5V2h-5Zm1 1h3v3h-3V3Z"
    fill-rule="evenodd"
    clip-rule="evenodd"
  />
  <!-- Position finder: bottom-left -->
  <path
    d="M0 15h9v9H0v-9Zm2 2v5h5v-5H2Zm1 1h3v3H3v-3Z"
    fill-rule="evenodd"
    clip-rule="evenodd"
  />
  <!-- Data pixels in the lower-right quadrant -->
  <rect x="11" y="11" width="3" height="3" />
  <rect x="16" y="12" width="2" height="2" />
  <rect x="20" y="11" width="3" height="3" />
  <rect x="12" y="16" width="2" height="2" />
  <rect x="15" y="19" width="3" height="3" />
  <rect x="20" y="16" width="2" height="2" />
  <rect x="19" y="15" width="2" height="2" />
  <rect x="11" y="20" width="3" height="3" />
</svg>
