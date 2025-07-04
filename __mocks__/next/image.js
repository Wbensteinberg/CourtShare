// Mock for next/image to prevent fill prop warnings in tests
const MockImage = (props) => {
  // Remove Next.js specific props that shouldn't be passed to DOM
  const { 
    fill, 
    priority, 
    sizes, 
    quality, 
    placeholder, 
    blurDataURL, 
    onLoad,
    onError,
    loader,
    unoptimized,
    ...imgProps 
  } = props;
  
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...imgProps} alt={props.alt || ""} />;
};

export default MockImage;