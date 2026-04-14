import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  name?: string | null;
  email?: string | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

function getInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.charAt(0).toUpperCase();
  return '?';
}

// Deterministic gradient based on name/email
function getGradient(str: string): string {
  const gradients = [
    'from-primary/80 to-primary/40',
    'from-accent/80 to-accent/40',
    'from-success/80 to-success/40',
    'from-warning/80 to-warning/40',
    'from-[hsl(260,60%,50%)]/80 to-[hsl(260,60%,50%)]/40',
    'from-[hsl(200,70%,45%)]/80 to-[hsl(200,70%,45%)]/40',
    'from-[hsl(330,60%,50%)]/80 to-[hsl(330,60%,50%)]/40',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return gradients[Math.abs(hash) % gradients.length];
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-xl',
};

const UserAvatar = ({ name, email, className, size = 'md' }: UserAvatarProps) => {
  const initials = getInitials(name, email);
  const gradient = getGradient(name || email || '');

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      <AvatarFallback className={cn('bg-gradient-to-br text-white font-bold', gradient)}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
};

export default UserAvatar;
