import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const defaults: IconProps = { width: 24, height: 24 };

export function UploadCloud(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...defaults} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16a4 4 0 0 1-.4-8A5 5 0 0 1 17.3 7a4 4 0 0 1 .7 8H16" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V10m0 0-3 3m3-3 3 3" />
    </svg>
  );
}

export function FileIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...defaults} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6M9 17h6" />
    </svg>
  );
}

export function ScanIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...defaults} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7V5a1 1 0 0 1 1-1h2m10 0h2a1 1 0 0 1 1 1v2m0 10v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9h8m-8 6h8" />
    </svg>
  );
}

export function SparklesIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...defaults} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m12 3 1.6 3.8L17 8.4l-3.4 1.6L12 13.8 10.4 10 7 8.4l3.4-1.6L12 3Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 15 .9 2.2L8 18l-2.1.8L5 21l-.9-2.2L2 18l2.1-.8L5 15Zm14-2 .8 1.8L22 16l-2.2.8L19 19l-.8-2.2L16 16l2.2-.8L19 13Z" />
    </svg>
  );
}

export function ClipboardCheck(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...defaults} {...props}>
      <rect x="8" y="3" width="8" height="4" rx="1.4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m9.3 14.2 1.9 1.9 3.7-3.7" />
    </svg>
  );
}

export function Check(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...defaults} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
    </svg>
  );
}

export function RefreshCw(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...defaults} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 2v6h-6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 8A9 9 0 1 0 22 12" />
    </svg>
  );
}

export function InboxIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...defaults} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16l-2 10H6L4 5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 15a5 5 0 0 0 10 0" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 19h12" />
    </svg>
  );
}

export function ArrowRight(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...defaults} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 12h14m-5-5 5 5-5 5" />
    </svg>
  );
}

export function X(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...defaults} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function CheckCircle(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...defaults} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function FileText(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...defaults} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9h1m-1 4h6m-6 4h6" />
    </svg>
  );
}

export function Sparkles(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...defaults} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m12 3 1.6 3.8L17 8.4l-3.4 1.6L12 13.8 10.4 10 7 8.4l3.4-1.6L12 3Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 15 .9 2.2L8 18l-2.1.8L5 21l-.9-2.2L2 18l2.1-.8L5 15Zm14-2 .8 1.8L22 16l-2.2.8L19 19l-.8-2.2L16 16l2.2-.8L19 13Z" />
    </svg>
  );
}

export function Zap(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...defaults} {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 2 3 14h8l-1 8 10-12h-8l1-8Z" />
    </svg>
  );
}
