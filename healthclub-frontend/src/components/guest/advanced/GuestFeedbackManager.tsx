import React from 'react';
import { Card, CardContent, Typography, Button, TextField, Box } from '@mui/material';

export const GuestFeedbackManager: React.FC<{ onSubmit?: (text: string) => void }>
  = ({ onSubmit }) => {
  const [text, setText] = React.useState('');
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Feedback</Typography>
        <TextField
          fullWidth
          label="Feedback"
          value={text}
          onChange={(e) => setText(e.target.value)}
          multiline
          rows={3}
        />
        <Box mt={1}>
          <Button variant="contained" size="small" onClick={() => onSubmit?.(text)}>Submit</Button>
        </Box>
      </CardContent>
    </Card>
  );
};


