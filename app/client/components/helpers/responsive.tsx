import * as React from "react";
import MediaQuery, { useMediaQuery } from "react-responsive";

const mobileSize = 767;
const defaultSize = 768;

export const isMobileQuery = { isMobile: `(max-width:${mobileSize}px)` };
export const isDefaultQuery = { isDesktop: `(min-width:${defaultSize}px)` };

type Props = {
  children: React.ReactNode;
};

export const Mobile: React.FunctionComponent<Props> = ({
  children
}: {
  children: React.ReactNode;
}) => {
  return <MediaQuery maxWidth={mobileSize}>{children}</MediaQuery>;
};
export const Default: React.FunctionComponent<Props> = ({
  children
}: {
  children: React.ReactNode;
}) => {
  return <MediaQuery minWidth={defaultSize}>{children}</MediaQuery>;
};

type mediaProps = { [key: string]: boolean }; // --> {isMobile: false}
type Query = { [key: string]: string }; // --> {isMobile: (max-width:767px)}