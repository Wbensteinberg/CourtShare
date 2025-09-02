import React from 'react';

interface GoogleMapsLinkProps {
  address: string;
  className?: string;
  children?: React.ReactNode;
  variant?: 'button' | 'link' | 'icon';
}

const GoogleMapsLink: React.FC<GoogleMapsLinkProps> = ({ 
  address, 
  className = '', 
  children,
  variant = 'button'
}) => {
  const googleMapsUrl = `https://maps.google.com/?q=${encodeURIComponent(address)}`;
  
  const getVariantStyles = () => {
    switch (variant) {
      case 'button':
        return 'inline-flex items-center gap-2 bg-[#286a3a] text-white py-3 px-6 rounded-lg hover:bg-[#20542e] transition-all duration-200 hover:cursor-pointer font-semibold shadow-md hover:shadow-lg';
      case 'link':
        return 'text-[#286a3a] hover:text-[#20542e] hover:underline transition-colors duration-200 hover:cursor-pointer';
      case 'icon':
        return 'text-[#286a3a] hover:text-[#20542e] transition-colors duration-200 hover:cursor-pointer';
      default:
        return '';
    }
  };

  const renderContent = () => {
    if (children) {
      return children;
    }

    switch (variant) {
      case 'button':
        return (
          <>
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            Open in Google Maps
          </>
        );
      case 'link':
        return 'View on Google Maps';
      case 'icon':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
          </svg>
        );
      default:
        return address;
    }
  };

  return (
    <a
      href={googleMapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`${getVariantStyles()} ${className}`}
      title={`Open ${address} in Google Maps`}
    >
      {renderContent()}
    </a>
  );
};

export default GoogleMapsLink;
