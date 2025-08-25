import React from 'react';

interface IdeaMemLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export default function IdeaMemLogo({ size = 32, className = '', showText = true }: IdeaMemLogoProps) {
  return (
    <div className={`flex items-center ${className}`}>
      {/* Light Bulb SVG Logo */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        {/* Light bulb outline */}
        <path
          d="M16 3C19.866 3 23 6.134 23 10C23 12.5 21.8 14.7 20 16.2V20C20 21.1 19.1 22 18 22H14C12.9 22 12 21.1 12 20V16.2C10.2 14.7 9 12.5 9 10C9 6.134 12.134 3 16 3Z"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
        
        {/* Light bulb base/screw threading */}
        <g stroke="currentColor" strokeWidth="1.5" opacity="0.8">
          <line x1="12" y1="23" x2="20" y2="23"/>
          <line x1="12.5" y1="25" x2="19.5" y2="25"/>
          <line x1="13" y1="27" x2="19" y2="27"/>
        </g>
        
        
        {/* Animated glow effect */}
        <circle 
          cx="16" 
          cy="11" 
          r="8" 
          fill="currentColor" 
          opacity="0.1"
        >
          <animate 
            attributeName="opacity" 
            values="0.05;0.2;0.05" 
            dur="3s" 
            repeatCount="indefinite"
          />
        </circle>
      </svg>
      
      {showText && (
        <span className="ml-3 text-lg font-semibold text-gray-900">IdeaMem</span>
      )}
    </div>
  );
}

// Favicon version - simplified for small sizes
export function IdeaMemFavicon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Simplified light bulb outline */}
      <path
        d="M8 2C10.2 2 12 3.8 12 6C12 7.3 11.4 8.4 10.5 9.1V10.5C10.5 11 10.1 11.5 9.5 11.5H6.5C5.9 11.5 5.5 11 5.5 10.5V9.1C4.6 8.4 4 7.3 4 6C4 3.8 5.8 2 8 2Z"
        stroke="#7C3AED"
        strokeWidth="1.2"
        fill="none"
      />
      
      {/* Simple base threading */}
      <g stroke="#7C3AED" strokeWidth="0.8" opacity="0.8">
        <line x1="6" y1="12" x2="10" y2="12"/>
        <line x1="6.5" y1="13" x2="9.5" y2="13"/>
      </g>
      
    </svg>
  );
}