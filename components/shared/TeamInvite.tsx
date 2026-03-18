'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Mail, Shield, Trash2, Loader2 } from 'lucide-react';

interface Member {
  id: string;
  email: string;
  role: string;
  invite_status: string;
  invited_at: string;
  user_id: string | null;
}

interface TeamInviteProps {
  businessId: string;
}

export default function TeamInvite({ businessId }: TeamInviteProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('employee');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    loadMembers();
  }, [businessId]);

  const loadMembers = async () => {
    const { data } = await supabase
      .from('business_members')
      .select('*')
      .eq('business_id', businessId)
      .neq('invite_status', 'revoked')
      .order('invited_at', { ascending: false });

    setMembers(data || []);
    setLoading(false);
  };

  const handleInvite = async () => {
    if (!inviteEmail || !user) return;
    setInviting(true);

    try {
      const { data, error } = await supabase.rpc('invite_team_member', {
        p_business_id: businessId,
        p_inviter_id: user.id,
        p_email: inviteEmail,
        p_role: inviteRole,
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast({ title: 'Invitation Sent', description: `Invited ${inviteEmail} as ${inviteRole}` });
      setInviteEmail('');
      loadMembers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setInviting(false);
    }
  };

  const handleRevoke = async (memberId: string) => {
    await supabase
      .from('business_members')
      .update({ invite_status: 'revoked' })
      .eq('id', memberId);

    toast({ title: 'Access Revoked' });
    loadMembers();
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-purple-100 text-purple-800';
      case 'manager': return 'bg-blue-100 text-blue-800';
      case 'employee': return 'bg-green-100 text-green-800';
      case 'viewer': return 'bg-slate-100 text-slate-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <Card className="shadow-lg border-slate-200">
      <CardHeader className="bg-gradient-to-r from-blue-900 to-blue-700 text-white rounded-t-lg">
        <CardTitle className="text-lg flex items-center gap-2">
          <UserPlus className="h-5 w-5" /> Team Members
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Invite form */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="team@example.com"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white"
          >
            <option value="employee">Employee</option>
            <option value="manager">Manager</option>
            <option value="viewer">Viewer</option>
          </select>
          <Button
            onClick={handleInvite}
            disabled={!inviteEmail || inviting}
            className="bg-blue-900 hover:bg-blue-800"
          >
            {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
            {inviting ? 'Sending...' : 'Invite'}
          </Button>
        </div>

        {/* Members list */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-4">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No team members yet. Invite your first team member above.</p>
          ) : (
            members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold text-blue-700">
                      {member.email[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{member.email}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${getRoleBadgeColor(member.role)}`}>
                        {member.role}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${getStatusBadgeColor(member.invite_status)}`}>
                        {member.invite_status}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handleRevoke(member.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
