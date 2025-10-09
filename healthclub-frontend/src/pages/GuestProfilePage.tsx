import React, { useEffect, useMemo, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { GuestProfile } from '../components/guest/GuestProfile';
import { Guest, guestsService } from '../services/guests';

function useQuery() {
  return useMemo(() => new URLSearchParams(window.location.search), []);
}

export const GuestProfilePage: React.FC = () => {
  const query = useQuery();
  const [guest, setGuest] = useState<Guest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const idParam = query.get('id');
    if (!idParam) {
      setError('No guest id provided');
      return;
    }
    const id = Number(idParam);
    if (!id || Number.isNaN(id)) {
      setError('Invalid guest id');
      return;
    }
    setLoading(true);
    guestsService
      .retrieve(id)
      .then((g) => setGuest(g))
      .catch(() => setError('Failed to load guest'))
      .finally(() => setLoading(false));
  }, [query]);

  if (loading) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" mt={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Typography color="error" variant="body2" mt={2}>
        {error}
      </Typography>
    );
  }

  if (!guest) {
    return null;
  }

  return (
    <GuestProfile
      guest={guest}
      onEdit={() => {}}
      onViewReservations={() => {}}
      onQuickReserve={() => {}}
    />
  );
};

export default GuestProfilePage;


