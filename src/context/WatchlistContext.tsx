import React, { createContext, useState, useContext, useEffect } from 'react';
import { Company } from '../api'; // Assuming Company type is defined elsewhere or remove if not needed
import { useAuth } from './AuthContext'; // Assuming AuthContext provides 'user'
import axios from 'axios';

export interface Watchlist {
  id: string;
  name: string;
  companies: Company[];
  categories?: string[]; // Keep for backwards compatibility
  isDefault?: boolean; // For special watchlists like "Real-Time Alerts" or the user's main watchlist
  createdAt: Date;
  type: 'company' | 'category' | 'mixed'; // Keep for backwards compatibility
}

interface WatchlistContextType {
  watchlists: Watchlist[];
  activeWatchlistId: string | null;
  setActiveWatchlistId: (id: string | null) => void;
  createWatchlist: (name: string, type?: 'company' | 'category' | 'mixed', categories?: string[]) => Promise<Watchlist>;
  renameWatchlist: (id: string, newName: string) => void; // TODO: Implement server sync
  deleteWatchlist: (id: string) => void; // TODO: Implement server sync
  addToWatchlist: (company: Company, watchlistId?: string) => Promise<boolean>;
  addCategoriesToWatchlist: (categories: string[], watchlistId?: string) => boolean; // Keep for backwards compatibility
  removeFromWatchlist: (companyId: string, watchlistId?: string) => void;
  removeCategoryFromWatchlist: (category: string, watchlistId?: string) => void; // Keep for backwards compatibility
  removeMultipleFromWatchlist: (companyIds: string[], watchlistId?: string) => void; // TODO: Implement server sync optimally
  clearWatchlist: (watchlistId?: string) => void;
  bulkAddToWatchlist: (companies: Company[], watchlistId?: string) => Promise<number>;
  isWatched: (companyId: string, watchlistId?: string) => boolean;
  isCategoryWatched: (category: string, watchlistId?: string) => boolean; // Keep for backwards compatibility
  getWatchlistById: (id: string) => Watchlist | undefined;
  getDefaultWatchlist: () => Watchlist | undefined; // Can be undefined if watchlists is empty
  getAlertsWatchlist: () => Watchlist | undefined; // Can be undefined if not created
  updateWatchlistCategories: (watchlistId: string, categories: string[]) => void; // Keep for backwards compatibility
}

const WatchlistContext = createContext<WatchlistContextType | undefined>(undefined);

// Generate a unique ID for optimistic updates
const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
};

export const WatchlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([] as Watchlist[]); // Initialize as empty array
  const [activeWatchlistId, setActiveWatchlistId] = useState<string | null>(null);
  const { user, isLoading: isUserLoading } = useAuth(); // Assuming useAuth provides isLoading
  const [isWatchlistLoading, setIsWatchlistLoading] = useState(false); // Track watchlist loading

  // Helper function for debugging API operations
  const logApiOperation = (operation: string, request: any, response?: any, error?: any) => {
    console.group(`API Operation: ${operation}`);
    console.log("Request:", request);
    if (response) console.log("Response:", response);
    if (error) console.error("Error:", error);
    console.groupEnd();
  };

  // Helper function to convert server watchlist format to frontend format
  const convertServerWatchlists = (serverWatchlists: any[]): Watchlist[] => {
    if (!Array.isArray(serverWatchlists)) {
        console.error("Expected serverWatchlists to be an array, but got:", serverWatchlists);
        return [];
    }
    return serverWatchlists.map(wl => {
      // Create company objects from ISINs
      // Assuming server sends an array of ISIN strings or company objects with isin
      const companies: Company[] = Array.isArray(wl.isin) ? wl.isin.map((isin: string) => ({
        // Populate minimal Company structure, you might need to fetch full details later
        id: isin, // Use ISIN as id if server doesn't provide a company ID
        symbol: '', // Placeholder
        name: '', // Placeholder
        isin: isin,
        industry: '' // Placeholder
      })) : []; // Handle case where 'isin' might not be an array

      // Determine if it's the default watchlist
      // Check server flag first, then fall back to name convention if needed
      const isDefault = wl.isDefault === true || wl.watchlistName === "My Watchlist"; // Adjust convention if server uses a different name

      return {
        id: wl._id || generateId(), // Use server ID, fallback to temp ID if missing (shouldn't happen for fetched)
        name: wl.watchlistName || 'My Watchlist',
        companies: companies,
        isDefault: isDefault,
        createdAt: wl.createdAt ? new Date(wl.createdAt) : new Date(), // Use server timestamp if available
        type: wl.type || 'company', // Use server type if available, default to 'company'
        categories: Array.isArray(wl.categories) ? wl.categories : [], // Handle categories if server provides them
      };
    });
  };

  // Function to create a default watchlist if none exists on the server
  const createDefaultWatchlist = async () => {
      // Ensure user is logged in and there are no watchlists currently loaded
      // The check `watchlists.length === 0` inside this function body prevents
      // creating multiple defaults if this function is called unnecessarily.
      if (!user || watchlists.length > 0) {
        // console.log('Default watchlist creation skipped: User not logged in or watchlists already exist.');
        return;
      }

      console.log('No watchlists found, attempting to create default watchlist...');

      try {
        // Create a temporary watchlist for optimistic update
        const tempId = generateId();
        const defaultWatchlist: Watchlist = {
          id: tempId, // Temporary ID
          name: "My Watchlist",
          companies: [], // Start empty
          createdAt: new Date(),
          type: 'company',
          isDefault: true // Mark locally as default
        };

        console.log('Optimistically adding default watchlist:', defaultWatchlist);
        // Add to local state first (optimistic update)
        setWatchlists([defaultWatchlist]); // Replace current empty list with the default
        setActiveWatchlistId(defaultWatchlist.id);

        // Then create on server
        console.log('Creating default watchlist on server...');
        // Ensure the payload matches the server API expectation
        const requestData = {
            operation: 'create',
            watchlistName: "My Watchlist",
            // Optional: include isDefault: true if your API uses it in the payload
            // isDefault: true
        };
        const response = await axios.post('/api/watchlist', requestData);

        logApiOperation('createDefaultWatchlist', requestData, response.data);

        // If successful, update with server data
        if (response.data && response.data.watchlist) {
          const serverWatchlist = response.data.watchlist;
          // Ensure the server response format is handled by convertServerWatchlists
          // Wrap the single server watchlist in an array for convertServerWatchlists
          const updatedWatchlistArray = convertServerWatchlists([serverWatchlist]);

          if (updatedWatchlistArray.length > 0) {
             const updatedWatchlist = updatedWatchlistArray[0];
             console.log('Server confirmed default watchlist creation, updating state:', updatedWatchlist);

             // Update the watchlists array, replacing our temp ID with server ID
             setWatchlists(prev =>
                prev.map(wl => wl.id === tempId ? updatedWatchlist : wl)
             );

             // Update active ID if needed (if the temp ID was active)
             setActiveWatchlistId(updatedWatchlist.id);
          } else {
              console.error("Server response for default watchlist creation was invalid or empty after conversion.");
              // Optionally, rollback or fetch again
               setWatchlists([]); // Rollback optimistic update
               setActiveWatchlistId(null);
          }

        } else {
           console.warn('Server response for creating default watchlist did not contain expected watchlist data:', response.data);
           // Handle cases where server succeeds but returns unexpected data
           // Optionally, rollback or fetch again
           setWatchlists([]); // Rollback optimistic update
           setActiveWatchlistId(null);
        }
      } catch (error: any) { // Use 'any' or a more specific error type
          console.error('Error creating default watchlist:', error.response?.data || error.message || error);
          logApiOperation('createDefaultWatchlist', { watchlistName: "My Watchlist" }, null, error);

          // Rollback optimistic update on error
          console.log('Rolling back optimistic default watchlist creation...');
          setWatchlists([]);
          setActiveWatchlistId(null);
      }
  };


  // Fetch watchlists from API when authenticated
  useEffect(() => {
    const fetchWatchlist = async () => {
      // Only fetch if user is available and not already loading
      if (!user || isUserLoading) {
          console.log('Fetch watchlist skipped: User not available or loading.');
          setWatchlists([]); // Clear watchlists if user logs out
          setActiveWatchlistId(null);
          return;
      }

      // Avoid fetching if watchlists are already populated, unless we need a refresh mechanism
      // This check ensures we don't refetch unnecessarily after createDefaultWatchlist updates state
      if (watchlists.length > 0 && !isWatchlistLoading) {
           console.log('Watchlists already exist, skipping fetch.');
           return;
      }

      setIsWatchlistLoading(true);
      console.log('Fetching watchlists from server...');

      try {
        const response = await axios.get('/api/watchlist');
        logApiOperation('fetchWatchlist', {}, response.data);

        if (response.data && response.data.watchlists && Array.isArray(response.data.watchlists)) {
          const convertedWatchlists = convertServerWatchlists(response.data.watchlists);
          console.log('Fetched and converted watchlists:', convertedWatchlists);

          setWatchlists(convertedWatchlists);

          // Check if any watchlists were loaded from the server
          if (convertedWatchlists.length > 0) {
            // Set the active watchlist: prefer default, otherwise the first one
            if (!activeWatchlistId) {
               const defaultWl = convertedWatchlists.find(wl => wl.isDefault) || convertedWatchlists[0];
               console.log(`Setting active watchlist to: ${defaultWl.name} (${defaultWl.id})`);
               setActiveWatchlistId(defaultWl.id);
            } else {
               // Keep the existing activeWatchlistId if it still exists in the fetched list
               const existingActive = convertedWatchlists.find(wl => wl.id === activeWatchlistId);
               if (!existingActive) {
                   // If the previously active watchlist was deleted on the server,
                   // fallback to default or first.
                   const defaultWl = convertedWatchlists.find(wl => wl.isDefault) || convertedWatchlists[0];
                   console.warn(`Previous active watchlist ${activeWatchlistId} not found, setting active to: ${defaultWl.name} (${defaultWl.id})`);
                   setActiveWatchlistId(defaultWl.id);
               } else {
                   console.log(`Keeping active watchlist: ${existingActive.name} (${existingActive.id})`);
               }
            }
          } else {
             // Case: Server returned success, but the watchlists array is empty
             console.log('Server returned 0 watchlists. Triggering default creation.');
             // Call createDefaultWatchlist if no watchlists were fetched
             // It will handle setting active ID internally
             await createDefaultWatchlist(); // Use await here
          }
        } else {
          // Case: Server response is missing watchlists or invalid format
          console.warn('Invalid or empty watchlist response format', response.data);
          // Assume no watchlists exist and create default
          console.log('Invalid response, assuming no watchlists exist. Creating default.');
          await createDefaultWatchlist(); // Use await here
        }
      } catch (error: any) {
        console.error('Error fetching watchlist:', error.response?.data || error.message || error);
        logApiOperation('fetchWatchlist', {}, null, error);
        // If fetching fails entirely, watchlists state will remain empty [],
        // which should trigger createDefaultWatchlist via the state change,
        // UNLESS the error was a 401 or similar suggesting the user isn't actually logged in.
        // The createDefaultWatchlist function already checks `!user`, so it should be safe.
      } finally {
        setIsWatchlistLoading(false);
      }
    };

    // Call fetchWatchlist when user changes or component mounts/re-renders initially
    fetchWatchlist();

  // Dependencies: user (to refetch when user logs in/out), isUserLoading (optional, to wait for user),
  // watchlists.length (to trigger fetch again if it becomes 0 somehow, or to prevent fetching if > 0 initially)
  // activeWatchlistId (so it can be preserved if possible after fetch)
  }, [user, isUserLoading]); // Removed watchlists.length from dependencies to avoid infinite loop potential with createDefaultWatchlist

  // useEffect to handle setting active watchlist if watchlists change AFTER initial fetch
  // This might be needed if watchlists are updated by other means (like creating a new one)
  useEffect(() => {
      if (!activeWatchlistId && watchlists.length > 0) {
          // Set the active watchlist: prefer default, otherwise the first one
          const defaultWl = watchlists.find(wl => wl.isDefault) || watchlists[0];
          console.log(`Setting initial active watchlist: ${defaultWl.name} (${defaultWl.id})`);
          setActiveWatchlistId(defaultWl.id);
      } else if (activeWatchlistId && !watchlists.find(wl => wl.id === activeWatchlistId)) {
          // If the active watchlist was removed, fallback
          if (watchlists.length > 0) {
              const defaultWl = watchlists.find(wl => wl.isDefault) || watchlists[0];
              console.warn(`Active watchlist ${activeWatchlistId} not found, setting active to: ${defaultWl.name} (${defaultWl.id})`);
              setActiveWatchlistId(defaultWl.id);
          } else {
              console.warn(`Active watchlist ${activeWatchlistId} not found, and no other watchlists available.`);
              setActiveWatchlistId(null);
          }
      }
  }, [watchlists, activeWatchlistId]); // Depend on watchlists array and activeId

  // Helper function to get watchlist by ID
  const getWatchlistById = (id: string): Watchlist | undefined => {
    return watchlists.find(watchlist => watchlist.id === id);
  };

  // Get the default watchlist - returns the one marked as default or the first one
  const getDefaultWatchlist = (): Watchlist | undefined => {
      // Find the watchlist explicitly marked as default
      const defaultWatchlist = watchlists.find(w => w.isDefault === true);
      if (defaultWatchlist) return defaultWatchlist;

      // If no explicit default, fall back to the first watchlist as a convention
      if (watchlists.length > 0) return watchlists[0];

      // If watchlists is empty, return undefined. Callers need to handle this.
      return undefined;
  };

  // Get the alerts watchlist (assuming it's a special watchlist)
  const getAlertsWatchlist = (): Watchlist | undefined => {
      // Assuming "Real-Time Alerts" is the name convention for this special watchlist
      return watchlists.find(w => w.name === "Real-Time Alerts");
      // Note: This function doesn't create the watchlist if it doesn't exist,
      // relying on it being fetched or created elsewhere.
  };

  // Create a new watchlist - UPDATED to use API and optimistic updates
  const createWatchlist = async (
    name: string,
    type: 'company' | 'category' | 'mixed' = 'company',
    categories?: string[]
  ): Promise<Watchlist> => {
    if (!user) {
      console.error('Cannot create watchlist: User not authenticated');
      throw new Error('User not authenticated');
    }

    console.log(`Attempting to create watchlist: ${name}`);

    // Create a temporary watchlist for optimistic update
    const tempId = generateId();
    const newWatchlist: Watchlist = {
      id: tempId,
      name,
      companies: [], // Start empty
      categories: type === 'company' ? undefined : categories || [],
      createdAt: new Date(),
      type,
      isDefault: false // User-created watchlists are not the primary default
    };

    console.log('Optimistically adding new watchlist:', newWatchlist);
    // Optimistically update state: Add the new watchlist
    setWatchlists(prev => [...prev, newWatchlist]);
    setActiveWatchlistId(newWatchlist.id); // Make it active immediately

    try {
      // Call server API with the expected format
      const requestData = {
        operation: 'create',
        watchlistName: name, // Server expects watchlistName
        // Optionally send type and categories if your API supports creating with these
        // type: type,
        // categories: categories
      };

      const response = await axios.post('/api/watchlist', requestData);
      logApiOperation('createWatchlist', requestData, response.data);

      if (response.data && response.data.watchlist) {
        const serverWatchlist = response.data.watchlist;
        // Use convertServerWatchlists to ensure consistency with fetched data format
        const updatedWatchlistArray = convertServerWatchlists([serverWatchlist]);

        if (updatedWatchlistArray.length > 0) {
            const updatedWatchlist = updatedWatchlistArray[0];
             console.log('Server confirmed watchlist creation, updating state:', updatedWatchlist);
             // Update the watchlists array, replacing our temp ID with server ID
             setWatchlists(prev =>
                prev.map(wl => wl.id === tempId ? updatedWatchlist : wl)
             );

             // Update active ID if needed (if the temp ID was active)
             if (activeWatchlistId === tempId) {
               setActiveWatchlistId(updatedWatchlist.id);
             }

             return updatedWatchlist; // Return the server-confirmed watchlist
        } else {
             console.error("Server response for new watchlist creation was invalid or empty after conversion.");
             // If server response is bad, keep the optimistic update but log error
             return newWatchlist;
        }

      } else {
         console.warn('Server response for creating watchlist did not contain expected watchlist data:', response.data);
         // If server response is bad, keep the optimistic update but log error
         return newWatchlist;
      }

    } catch (error: any) {
      console.error('Error creating watchlist:', error.response?.data || error.message || error);
      logApiOperation('createWatchlist', { name }, null, error);

      // Rollback optimistic update on error
      console.log('Rolling back optimistic watchlist creation...');
      setWatchlists(prev => prev.filter(wl => wl.id !== tempId));

      // If the deleted watchlist was the active one, set active to default or first
      if (activeWatchlistId === tempId) {
        const defaultWl = getDefaultWatchlist();
        setActiveWatchlistId(defaultWl ? defaultWl.id : null);
      }

      throw error; // Re-throw the error so caller knows it failed
    }
  };

  // Rename a watchlist (Frontend only for now, needs API sync)
  const renameWatchlist = (id: string, newName: string) => {
      const watchlist = getWatchlistById(id);
      if (!watchlist) return;
      // Prevent renaming the default watchlist if you have strict rules
      // if (watchlist.isDefault) {
      //     console.warn("Cannot rename default watchlist.");
      //     return;
      // }

      setWatchlists(prev =>
          prev.map(wl =>
              wl.id === id ? { ...wl, name: newName } : wl
          )
      );

      // TODO: Add API call to persist the change to the server
      // axios.post('/api/watchlist', { operation: 'rename', watchlist_id: id, newName: newName })
      //   .catch(error => {
      //      console.error('Error renaming watchlist on server:', error);
      //      // Handle rollback or re-fetch on server error if needed
      //   });
  };


  // Delete a watchlist (Frontend only for now, needs API sync)
  const deleteWatchlist = (id: string) => {
    const watchlistToDelete = getWatchlistById(id);
    if (!watchlistToDelete) return;

    // Prevent deleting default watchlists
    if (watchlistToDelete.isDefault) {
        console.warn("Cannot delete default watchlist.");
        return;
    }

    // Optimistically update state
    setWatchlists(prev => prev.filter(watchlist => watchlist.id !== id));

    // If the active watchlist is being deleted, set the default/first as active
    if (activeWatchlistId === id) {
      const defaultWatchlist = getDefaultWatchlist();
      setActiveWatchlistId(defaultWatchlist ? defaultWatchlist.id : null); // Null if no watchlists left
    }

    // TODO: Add API call to delete the watchlist on the server
    // axios.delete(`/api/watchlist/${id}`) // Assuming DELETE method with ID path
    //   .catch(error => {
    //      console.error('Error deleting watchlist on server:', error);
    //      // Handle rollback or re-fetch on server error if needed
    //   });
  };


  // Add a company to a specific watchlist - UPDATED to use API and optimistic updates
  const addToWatchlist = async (company: Company, watchlistId?: string): Promise<boolean> => {
    if (!user) {
      console.error('Cannot add to watchlist: User not authenticated');
      return false;
    }

    const targetWatchlistId = watchlistId || activeWatchlistId || getDefaultWatchlist()?.id;

    if (!targetWatchlistId) {
        console.error('Cannot add to watchlist: No target watchlist specified or found.');
        return false;
    }

    const targetWatchlist = getWatchlistById(targetWatchlistId);
    if (!targetWatchlist) {
         console.error('Cannot add to watchlist: Target watchlist not found in state.');
         return false;
    }

    // Log operation for debugging
    console.log(`Attempting to add company ${company.name || company.isin} (ISIN: ${company.isin}) to watchlist ${targetWatchlist.name} (${targetWatchlistId})`);

    // Check if the company is already in the watchlist using its unique ID (ISIN in this case)
    if (targetWatchlist.companies.some(c => c.id === company.id)) { // Using company.id which is ISIN
      console.log('Company already in watchlist, skipping add.');
      return false;
    }

    // Ensure the company object has at least the ISIN which is used as ID
    if (!company.id || !company.isin) {
         console.error('Cannot add company: Missing company ID or ISIN.', company);
         return false;
    }

    // Optimistically update UI
    console.log('Optimistically adding company to watchlist...');
    setWatchlists(prev =>
      prev.map(watchlist => {
        if (watchlist.id === targetWatchlistId) {
          // Create a copy of the company object if necessary to ensure immutability,
          // or use the one provided if you trust it's new/immutable.
          const companyToAdd: Company = { ...company, id: company.isin }; // Ensure ID is ISIN for consistency

          // Prevent duplicates even in optimistic update just in case
          if (!watchlist.companies.some(c => c.id === companyToAdd.id)) {
             return {
                ...watchlist,
                companies: [...watchlist.companies, companyToAdd]
             };
          }
        }
        return watchlist;
      })
    );

    try {
      // Call server API with exactly the format it expects
      // Assumes server uses ISIN for company identification within a watchlist
      const requestData = {
        operation: 'add_isin', // Based on your snippet
        watchlist_id: targetWatchlistId, // Server expects watchlist_id
        isin: company.isin // Server expects isin
      };

      const response = await axios.post('/api/watchlist', requestData);
      logApiOperation('addToWatchlist', requestData, response.data);

      // If the server sent updated watchlists array, update our state completely
      // This is safer than partial updates if the server is the source of truth
      if (response.data && Array.isArray(response.data.watchlists)) {
         console.log('Server returned updated watchlists, syncing state...');
         const updatedWatchlists = convertServerWatchlists(response.data.watchlists);
         setWatchlists(updatedWatchlists);
      }
       // If server returned only success confirmation, the optimistic update is sufficient

      return true; // Indicate success

    } catch (error: any) {
      console.error('Error adding to watchlist:', error.response?.data || error.message || error);
      logApiOperation('addToWatchlist', { company: company.isin, watchlistId: targetWatchlistId }, null, error);

      // Rollback optimistic update on error
      console.log('Rolling back optimistic add to watchlist...');
       setWatchlists(prev =>
         prev.map(watchlist => {
           if (watchlist.id === targetWatchlistId) {
             return {
               ...watchlist,
               companies: watchlist.companies.filter(c => c.id !== company.id) // Filter by company.id (ISIN)
             };
           }
           return watchlist;
         })
       );

      return false; // Indicate failure
    }
  };


  // Add categories to a specific watchlist (keeping for backwards compatibility/if your API supports it)
  // Note: This doesn't currently sync with the API. You'd need API endpoints for category management.
  const addCategoriesToWatchlist = (categories: string[], watchlistId?: string): boolean => {
    const targetWatchlistId = watchlistId || activeWatchlistId || getDefaultWatchlist()?.id;

    if (!targetWatchlistId) {
        console.error('Cannot add categories: No target watchlist specified or found.');
        return false;
    }
    const watchlist = getWatchlistById(targetWatchlistId);
    if (!watchlist) {
        console.error('Cannot add categories: Target watchlist not found in state.');
        return false;
    }

    // Filter out categories that are already in the watchlist
    const currentCategories = watchlist.categories || [];
    const newCategories = categories.filter(
      category => !currentCategories.includes(category)
    );

    if (newCategories.length === 0) {
        console.log('No new categories to add.');
        return false;
    }

    setWatchlists(prev =>
      prev.map(wl => {
        if (wl.id === targetWatchlistId) {
          const updatedCategories = [...currentCategories, ...newCategories];
          // Determine the appropriate watchlist type based on content
          let newType = wl.type;
          if (wl.companies.length > 0 && updatedCategories.length > 0) {
              newType = 'mixed';
          } else if (wl.companies.length === 0 && updatedCategories.length > 0) {
              newType = 'category';
          } else if (wl.companies.length > 0 && updatedCategories.length === 0) {
              newType = 'company'; // Should not happen here if adding, but good logic
          } else if (wl.companies.length === 0 && updatedCategories.length === 0) {
              newType = 'company'; // Default if empty
          }

          return {
            ...wl,
            categories: updatedCategories,
            type: newType
          };
        }
        return wl;
      })
    );

    // TODO: Add API call to persist the change to the server if your API supports it
    // axios.post('/api/watchlist', { operation: 'add_categories', watchlist_id: targetWatchlistId, categories: newCategories })
    //   .catch(error => console.error('Error adding categories to watchlist on server:', error));

    return true; // Indicate success (frontend update)
  };

   // Update all watchlist categories (replace existing categories) (keeping for backwards compatibility)
   // Note: This doesn't currently sync with the API.
   const updateWatchlistCategories = (watchlistId: string, categories: string[]) => {
       const watchlist = getWatchlistById(watchlistId);
       if (!watchlist) {
           console.error('Cannot update categories: Watchlist not found.');
           return;
       }

        setWatchlists(prev =>
            prev.map(wl => {
                if (wl.id === watchlistId) {
                    // Determine the appropriate watchlist type
                    let newType = wl.type;
                    if (categories.length > 0 && wl.companies.length > 0) {
                      newType = 'mixed';
                    } else if (categories.length > 0 && wl.companies.length === 0) {
                      newType = 'category';
                    } else if (categories.length === 0 && wl.companies.length > 0) {
                      newType = 'company';
                    } else if (categories.length === 0 && wl.companies.length === 0) {
                       newType = 'company'; // Default if empty
                    }

                    return {
                        ...wl,
                        categories: categories,
                        type: newType
                    };
                }
                return wl;
            })
        );

       // TODO: Add API call to persist the change to the server if your API supports it
       // axios.post('/api/watchlist', { operation: 'update_categories', watchlist_id: watchlistId, categories: categories })
       //   .catch(error => console.error('Error updating categories on server:', error));
   };


  // Remove a category from a watchlist (keeping for backwards compatibility)
  // Note: This doesn't currently sync with the API.
  const removeCategoryFromWatchlist = (category: string, watchlistId?: string) => {
    const targetWatchlistId = watchlistId || activeWatchlistId || getDefaultWatchlist()?.id;

    if (!targetWatchlistId) {
        console.error('Cannot remove category: No target watchlist specified or found.');
        return;
    }

    setWatchlists(prev =>
      prev.map(wl => {
        if (wl.id === targetWatchlistId && wl.categories) {
          const newCategories = wl.categories.filter(c => c !== category);

          // Determine the type based on remaining content
          let newType = wl.type;
          if (newCategories.length === 0 && wl.companies.length > 0) {
            newType = 'company';
          } else if (newCategories.length > 0 && wl.companies.length === 0) {
            newType = 'category';
          } else if (newCategories.length === 0 && wl.companies.length === 0) {
             newType = 'company'; // Default if empty
          }

          return {
            ...wl,
            categories: newCategories,
            type: newType
          };
        }
        return wl;
      })
    );

    // TODO: Add API call to persist the change to the server if your API supports it
    // axios.post('/api/watchlist', { operation: 'remove_category', watchlist_id: targetWatchlistId, category: category })
    //   .catch(error => console.error('Error removing category from watchlist on server:', error));
  };


  // Remove a company from a specific watchlist - UPDATED to use API and optimistic updates
  const removeFromWatchlist = (companyId: string, watchlistId?: string) => {
    if (!user) {
        console.error('Cannot remove from watchlist: User not authenticated');
        return;
    }

    const targetWatchlistId = watchlistId || activeWatchlistId || getDefaultWatchlist()?.id;
    if (!targetWatchlistId) {
        console.error('Cannot remove from watchlist: No target watchlist specified or found.');
        return;
    }

    const targetWatchlist = getWatchlistById(targetWatchlistId);
    if (!targetWatchlist) {
         console.error('Cannot remove from watchlist: Target watchlist not found in state.');
         return;
    }

    // Find the company to get its ISIN (used as ID in the frontend structure)
    const companyToRemove = targetWatchlist.companies.find(c => c.id === companyId);
    if (!companyToRemove) {
        console.warn(`Company with ID ${companyId} not found in watchlist ${targetWatchlist.name}.`);
        return;
    }
    if (!companyToRemove.isin) {
         console.error(`Company with ID ${companyId} is missing ISIN, cannot remove from server.`);
         // You might still remove it locally if needed, but server sync will fail
         setWatchlists(prev =>
            prev.map(watchlist => {
              if (watchlist.id === targetWatchlistId) {
                return {
                  ...watchlist,
                  companies: watchlist.companies.filter(c => c.id !== companyId)
                };
              }
              return watchlist;
            })
          );
         return;
    }

    // Optimistically update UI
    console.log(`Optimistically removing company ${companyId} from watchlist ${targetWatchlistId}...`);
    setWatchlists(prev =>
      prev.map(watchlist => {
        if (watchlist.id === targetWatchlistId) {
          return {
            ...watchlist,
            companies: watchlist.companies.filter(c => c.id !== companyId)
          };
        }
        return watchlist;
      })
    );

    // Call API to remove from watchlist using ISIN
    // Assuming API endpoint is DELETE /api/watchlist/:watchlistId/isin/:isin
    axios.delete(`/api/watchlist/${targetWatchlistId}/isin/${companyToRemove.isin}`)
      .then(response => {
        logApiOperation('removeFromWatchlist', { watchlistId: targetWatchlistId, isin: companyToRemove.isin }, response.data);

        // Optionally refetch or sync state from server response if it returns updated list
        if (response.data && Array.isArray(response.data.watchlists)) {
             console.log('Server returned updated watchlists after removal, syncing state...');
             const updatedWatchlists = convertServerWatchlists(response.data.watchlists);
             setWatchlists(updatedWatchlists);
        }
        // If server response doesn't include the full list, the optimistic update is enough
        // provided the API confirms success.

      })
      .catch(error => {
        console.error('Error removing from watchlist:', error.response?.data || error.message || error);
        logApiOperation('removeFromWatchlist', { watchlistId: targetWatchlistId, isin: companyToRemove.isin }, null, error);

        // Rollback on error: Add the company back to the list
        console.log('Rolling back optimistic remove from watchlist...');
        setWatchlists(prev =>
            prev.map(watchlist => {
              if (watchlist.id === targetWatchlistId) {
                 // Add back only if it's not somehow already back (shouldn't happen)
                 if (!watchlist.companies.some(c => c.id === companyToRemove.id)) {
                     return {
                       ...watchlist,
                       companies: [...watchlist.companies, companyToRemove] // Add the original company object back
                     };
                 }
              }
              return watchlist;
            })
          );
      });
  };

  // Remove multiple companies from a watchlist (calls removeFromWatchlist for each)
  // Note: This performs N API calls. A bulk remove API might be more efficient.
  const removeMultipleFromWatchlist = (companyIds: string[], watchlistId?: string) => {
    if (!user) {
       console.error('Cannot remove multiple: User not authenticated');
       return;
    }
    const targetWatchlistId = watchlistId || activeWatchlistId || getDefaultWatchlist()?.id;
     if (!targetWatchlistId) {
        console.error('Cannot remove multiple: No target watchlist specified or found.');
        return;
     }

    console.log(`Attempting to remove multiple companies (${companyIds.length}) from watchlist ${targetWatchlistId}`);
    // For simplicity, call the single remove function for each.
    // A more advanced implementation would use a bulk API endpoint if available.
    companyIds.forEach(id => removeFromWatchlist(id, targetWatchlistId));

    // TODO: If you have a bulk API:
    // const companiesToRemove = getWatchlistById(targetWatchlistId)?.companies.filter(c => companyIds.includes(c.id));
    // const isinsToRemove = companiesToRemove?.map(c => c.isin).filter(Boolean);
    // if (!isinsToRemove || isinsToRemove.length === 0) return;
    // axios.post('/api/watchlist', { operation: 'remove_isins', watchlist_id: targetWatchlistId, isins: isinsToRemove })
    //   .then(...)
    //   .catch(...)
  };

  // Clear all companies and categories from a watchlist - UPDATED to use API
  const clearWatchlist = (watchlistId?: string) => {
    if (!user) {
      console.error('Cannot clear watchlist: User not authenticated');
      return;
    }

    const targetWatchlistId = watchlistId || activeWatchlistId || getDefaultWatchlist()?.id;
     if (!targetWatchlistId) {
        console.error('Cannot clear watchlist: No target watchlist specified or found.');
        return;
     }

    const watchlistToClear = getWatchlistById(targetWatchlistId);
    if (!watchlistToClear) {
         console.error('Cannot clear watchlist: Target watchlist not found in state.');
         return;
    }


    // Optimistically update UI
    console.log(`Optimistically clearing watchlist ${watchlistToClear.name} (${targetWatchlistId})...`);
    // Store current items for potential rollback
    const currentCompanies = watchlistToClear.companies;
    const currentCategories = watchlistToClear.categories || [];
    const currentType = watchlistToClear.type;


    setWatchlists(prev =>
      prev.map(watchlist =>
        watchlist.id === targetWatchlistId
          ? { ...watchlist, companies: [], categories: [], type: 'company' } // Reset type to company or default
          : watchlist
      )
    );

    // Call API to clear watchlist
    // Assuming API endpoint is POST /api/watchlist/:watchlistId/clear
    axios.post(`/api/watchlist/${targetWatchlistId}/clear`)
      .then(response => {
        logApiOperation('clearWatchlist', { watchlistId: targetWatchlistId }, response.data);

        // Optionally refetch or sync state from server response if it returns updated list
         if (response.data && Array.isArray(response.data.watchlists)) {
              console.log('Server returned updated watchlists after clear, syncing state...');
              const updatedWatchlists = convertServerWatchlists(response.data.watchlists);
              setWatchlists(updatedWatchlists);
         }
         // If server response doesn't include the full list, the optimistic update is enough

      })
      .catch(error => {
        console.error('Error clearing watchlist:', error.response?.data || error.message || error);
        logApiOperation('clearWatchlist', { watchlistId: targetWatchlistId }, null, error);

        // Rollback on error: Restore the previous state
        console.log('Rolling back optimistic clear watchlist...');
        setWatchlists(prev =>
             prev.map(watchlist =>
               watchlist.id === targetWatchlistId
                 ? { ...watchlist, companies: currentCompanies, categories: currentCategories, type: currentType }
                 : watchlist
             )
           );
      });
  };


  // Bulk add companies to a watchlist - UPDATED to use API (batching recommended)
  const bulkAddToWatchlist = async (companies: Company[], watchlistId?: string): Promise<number> => {
    if (!companies || companies.length === 0 || !user) {
      console.log('Bulk add skipped: No companies, or user not authenticated.');
      return 0;
    }

    const targetWatchlistId = watchlistId || activeWatchlistId || getDefaultWatchlist()?.id;
     if (!targetWatchlistId) {
         console.error('Cannot bulk add: No target watchlist specified or found.');
         return 0;
     }

    const targetWatchlist = getWatchlistById(targetWatchlistId);
    if (!targetWatchlist) {
         console.error('Cannot bulk add: Target watchlist not found in state.');
         return 0;
    }


    // Filter out companies that are already in the watchlist using ISIN as ID
    const companiesToAdd = companies.filter(company =>
      !targetWatchlist.companies.some(c => c.id === company.isin) // Compare by ISIN
    ).map(company => ({ ...company, id: company.isin })); // Ensure ID is ISIN for companies being added


    if (companiesToAdd.length === 0) {
        console.log('Bulk add skipped: All companies already in watchlist.');
        return 0;
    }

    console.log(`Attempting to bulk add ${companiesToAdd.length} companies to watchlist ${targetWatchlist.name} (${targetWatchlistId})...`);

    // Optimistically update UI
    console.log('Optimistically adding companies to watchlist...');
    setWatchlists(prev =>
      prev.map(watchlist => {
        if (watchlist.id === targetWatchlistId) {
           // Prevent duplicates during optimistic update too
           const existingIds = new Set(watchlist.companies.map(c => c.id));
           const uniqueNewCompanies = companiesToAdd.filter(c => !existingIds.has(c.id));

          return {
            ...watchlist,
            companies: [...watchlist.companies, ...uniqueNewCompanies]
          };
        }
        return watchlist;
      })
    );

    let addedCount = 0;
    const isinsToAdd = companiesToAdd.map(c => c.isin).filter(Boolean) as string[]; // Get ISINs to send to API

    if (isinsToAdd.length === 0) {
         console.error('No valid ISINs found in companies to bulk add.');
         // Rollback optimistic update? Complex for bulk.
         return 0;
    }

    try {
      // Use a single bulk API call if available, or batch single calls
      // Assuming your API supports a bulk add operation
      const requestData = {
         operation: 'add_isins', // Example bulk operation
         watchlist_id: targetWatchlistId,
         isins: isinsToAdd
      };

      const response = await axios.post('/api/watchlist', requestData); // Or a dedicated bulk endpoint
      logApiOperation('bulkAddToWatchlist', requestData, response.data);

      if (response.data && Array.isArray(response.data.watchlists)) {
           console.log('Server returned updated watchlists after bulk add, syncing state...');
           const updatedWatchlists = convertServerWatchlists(response.data.watchlists);
           setWatchlists(updatedWatchlists);
           // Assuming server response implies success for all sent ISINs or includes added count
           addedCount = isinsToAdd.length; // Or parse from response if server gives a count
      } else if (response.data && response.data.addedCount !== undefined) {
           console.log('Server confirmed bulk add, count:', response.data.addedCount);
           addedCount = response.data.addedCount;
           // If server doesn't return full list, optimistic update is hopefully correct
      } else {
          console.warn('Bulk add response did not contain expected data, assuming partial success.', response.data);
          // Cannot confirm added count precisely without specific server response format
          addedCount = isinsToAdd.length; // Optimistic assumption
      }

      // Note: Handling partial failures in bulk adds requires more sophisticated server response
      // and frontend rollback/sync logic. This currently assumes either full success or full failure.

      return addedCount;

    } catch (error: any) {
      console.error('Error in bulk add operation:', error.response?.data || error.message || error);
      logApiOperation('bulkAddToWatchlist', { watchlistId: targetWatchlistId, isins: isinsToAdd }, null, error);

      // Rollback on bulk error is complex. For simplicity, we might leave the optimistic
      // update and rely on the user re-syncing or the next fetch correcting the state.
      // A more robust implementation would track which ISINs failed and remove only those.

      // As a basic rollback: revert the entire optimistic batch add
       console.log('Rolling back optimistic bulk add from watchlist...');
       setWatchlists(prev =>
            prev.map(watchlist => {
              if (watchlist.id === targetWatchlistId) {
                 const isinSetToAdd = new Set(isinsToAdd);
                 return {
                   ...watchlist,
                   companies: watchlist.companies.filter(c => !isinSetToAdd.has(c.id)) // Filter out the ones we optimistically added
                 };
              }
              return watchlist;
            })
         );

      throw error; // Re-throw the error
    }
  };


  // Check if a company (by ID, which is ISIN) is in a specific watchlist or any watchlist
  const isWatched = (companyId: string, watchlistId?: string): boolean => {
      // Ensure companyId is treated as ISIN for lookup
      const isin = companyId; // Assuming companyId passed here is the ISIN

      if (watchlistId) {
        const watchlist = getWatchlistById(watchlistId);
        // Check if the watchlist exists and contains a company with the matching ISIN
        return !!watchlist?.companies.some(company => company.isin === isin);
      }

      // If no watchlistId is provided, check if the company is in *any* watchlist
      return watchlists.some(watchlist =>
        watchlist.companies.some(company => company.isin === isin)
      );
  };

  // Check if a category is in a specific watchlist or any watchlist (keeping for backwards compatibility)
  const isCategoryWatched = (category: string, watchlistId?: string): boolean => {
    if (watchlistId) {
      const watchlist = getWatchlistById(watchlistId);
      return !!watchlist?.categories?.includes(category);
    }

    // If no watchlistId is provided, check all watchlists
    return watchlists.some(watchlist =>
      watchlist.categories?.includes(category)
    );
  };


  return (
    <WatchlistContext.Provider
      value={{
        watchlists,
        activeWatchlistId,
        setActiveWatchlistId,
        createWatchlist,
        renameWatchlist,
        deleteWatchlist,
        addToWatchlist,
        addCategoriesToWatchlist, // Keep for backwards compatibility
        removeFromWatchlist,
        removeCategoryFromWatchlist, // Keep for backwards compatibility
        removeMultipleFromWatchlist,
        clearWatchlist,
        bulkAddToWatchlist,
        isWatched,
        isCategoryWatched, // Keep for backwards compatibility
        getWatchlistById,
        getDefaultWatchlist,
        getAlertsWatchlist,
        updateWatchlistCategories, // Keep for backwards compatibility
      }}
    >
      {children}
    </WatchlistContext.Provider>
  );
};

export const useWatchlist = () => {
  const context = useContext(WatchlistContext);
  if (context === undefined) {
    throw new Error('useWatchlist must be used within a WatchlistProvider');
  }
  return context;
};

// You might need to adjust the Company interface based on your actual api.ts or types
// Example placeholder if you don't have api.ts defined here:
/*
export interface Company {
    id: string; // Should be ISIN for consistency with backend sync
    symbol: string;
    name: string;
    isin: string;
    industry: string;
    // Add other fields your Company type might have
}
*/