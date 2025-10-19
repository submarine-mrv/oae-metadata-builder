import React from 'react';
import { Modal, Text, Box, Divider, Anchor } from '@mantine/core';
import ReactMarkdown from 'react-markdown';

interface DescriptionModalProps {
  opened: boolean;
  onClose: () => void;
  title: string;
  description: string;
}

const DescriptionModal: React.FC<DescriptionModalProps> = ({
  opened,
  onClose,
  title,
  description
}) => {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title}
      size="md"
      zIndex={1200}
    >
      <Divider mb="md" color="gray.3" />
      <Box
        style={{
          fontSize: '14px',
          lineHeight: 1.5
        }}
      >
        <ReactMarkdown
          components={{
            p: ({ children }) => (
              <Text component="p" size="sm" mb="sm" style={{ lineHeight: 1.6 }}>
                {children}
              </Text>
            ),
            br: () => <br style={{ marginBottom: '8px' }} />,
            ul: ({ children }) => (
              <Box
                component="ul"
                ml="md"
                mb="xs"
                style={{
                  listStyleType: 'disc',
                  paddingLeft: '16px'
                }}
              >
                {children}
              </Box>
            ),
            li: ({ children }) => (
              <Text
                component="li"
                size="sm"
                mb={2}
                style={{
                  display: 'list-item',
                  listStyleType: 'disc'
                }}
              >
                {children}
              </Text>
            ),
            a: ({ href, children }) => (
              <Anchor
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                underline="always"
                size="sm"
              >
                {children}
              </Anchor>
            )
          }}
        >
          {description
            // Convert single newlines to double newlines, but NOT for list items
            .replace(/\n(?!\n)(?!\s*[-*+])/g, '\n\n')
            // Clean up any triple+ newlines
            .replace(/\n{3,}/g, '\n\n')
          }
        </ReactMarkdown>
      </Box>
    </Modal>
  );
};

export default DescriptionModal;