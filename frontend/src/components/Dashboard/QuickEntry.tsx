import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { Card, CardActionArea, Stack, Typography } from '@mui/material';
import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded';
import { alpha, useTheme } from '@mui/material/styles';

const QuickEntry = observer(() => {
  const navigate = useNavigate();
  const theme = useTheme();

  return (
    <section className="dashboard-section">
      <Typography className="section-title" variant="h6" gutterBottom>
        快捷录入
      </Typography>
      <div className="quick-entry-grid">
        <Card
          className="quick-entry-card"
          sx={{
            borderRadius: 4,
            overflow: 'hidden',
            background: [
              `radial-gradient(circle at top right, ${alpha(theme.palette.secondary.main, 0.16)}, transparent 30%)`,
              `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)}, ${alpha(theme.palette.primary.main, 0.03)})`,
            ].join(','),
          }}
        >
          <CardActionArea
            onClick={() => navigate('/entry/unified')}
            sx={{
              px: 2.5,
              py: 2.2,
            }}
          >
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <AddCircleRoundedIcon color="primary" sx={{ fontSize: 36 }} />
              <Stack spacing={0.5}>
                <Typography className="quick-entry-card__title" variant="subtitle1" sx={{ fontWeight: 700 }}>
                  统一录入
                </Typography>
                <Typography className="quick-entry-card__desc" variant="body2" color="text.secondary">
                  一次性录入账户资金、银证流水、多心魔持仓
                </Typography>
              </Stack>
            </Stack>
          </CardActionArea>
        </Card>
      </div>
    </section>
  );
});

export default QuickEntry;
