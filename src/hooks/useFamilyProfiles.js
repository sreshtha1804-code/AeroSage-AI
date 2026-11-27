import { useCallback, useEffect, useState } from 'react';
import { createFamilyMember, deleteFamilyMember, getFamily } from '../lib/api.js';
import { getDeviceId, loadFamily, saveFamily, uid } from '../lib/storage.js';

/**
 * Household profiles. Stored in Supabase when the server has it configured, otherwise on this device.
 * If a cloud save fails the member is still kept locally, so the user never loses what they typed.
 */
export function useFamilyProfiles() {
  const [deviceId] = useState(getDeviceId);
  const [members, setMembers] = useState(loadFamily);
  const [cloudEnabled, setCloudEnabled] = useState(false);

  useEffect(() => {
    getFamily(deviceId)
      .then((result) => {
        if (!result.enabled) {
          return;
        }
        setCloudEnabled(true);
        setMembers(result.items);
      })
      .catch(() => {
        /* cloud storage unavailable: keep the on-device list */
      });
  }, [deviceId]);

  useEffect(() => {
    if (!cloudEnabled) {
      saveFamily(members);
    }
  }, [members, cloudEnabled]);

  const addMember = useCallback(
    async (name, type) => {
      if (cloudEnabled) {
        try {
          const { item } = await createFamilyMember({ device: deviceId, name, type });
          if (item) {
            setMembers((current) => [...current, item]);
            return;
          }
        } catch {
          /* fall through to local storage */
        }
      }
      setMembers((current) => [...current, { id: uid(), name, type }]);
    },
    [cloudEnabled, deviceId],
  );

  const removeMember = useCallback(
    (id) => {
      setMembers((current) => current.filter((member) => member.id !== id));
      if (cloudEnabled) {
        deleteFamilyMember(id, deviceId).catch(() => {});
      }
    },
    [cloudEnabled, deviceId],
  );

  return { members, cloudEnabled, addMember, removeMember };
}
