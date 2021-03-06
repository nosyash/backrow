package cache

import (
	"log"

	"github.com/nosyash/backrow/jwt"
)

// AddUser read information about user from Database and add the user to the user cache
func (u *Users) addUser(payload *jwt.Payload) {
	userProfile, err := u.db.GetUserByUUID(payload.UUID)
	if err != nil {
		log.Printf("u.db.GetUserByUUID(): %v", err)
		return
	}

	u.rm.Lock()
	defer u.rm.Unlock()

	u.users[payload.UUID] = &User{
		Name:    userProfile.Name,
		Color:   userProfile.Color,
		Image:   userProfile.Image,
		Payload: payload,
		Guest:   false,
		ID:      getHashOfString(payload.UUID[:16]),
	}

	u.UpdateUsers <- struct{}{}
}

// AddGuest add guest user to the user cache
func (u *Users) addGuest(user *User) {
	u.rm.Lock()
	defer u.rm.Unlock()

	u.users[user.UUID] = user
	u.UpdateUsers <- struct{}{}
}

// DelUser delete a user from the cache
func (u *Users) delUser(uuid string) {
	u.rm.Lock()
	defer u.rm.Unlock()

	delete(u.users, uuid)
	u.DelFeedback <- struct{}{}
}

// GetUserByUUID return user object by UUID
func (u Users) GetUserByUUID(uuid string) (*User, bool) {
	user, ok := u.users[uuid]
	return user, ok
}

// GetUUIDByID return user UUID by ID
func (u Users) GetUUIDByID(id string) string {
	for uuid, user := range u.users {
		if user.ID == id {
			return uuid
		}
	}

	return ""
}

// UpdateUser update user in cache, image, nickname, color etc.
func (u *Users) UpdateUser(uuid string) {
	userProfile, err := u.db.GetUserByUUID(uuid)
	if err != nil {
		log.Printf("u.db.GetUserByUUID(): %v", err)
	}

	if user, ok := u.GetUserByUUID(uuid); ok {
		user.Name = userProfile.Name
		user.Color = userProfile.Color
		user.Image = userProfile.Image

		u.UpdateUsers <- struct{}{}
	}
}

// UsersCount return count users for current room
func (u Users) UsersCount() int {
	return len(u.users)
}

// GetAllUsers return all users
func (u Users) GetAllUsers() []*User {
	var users []*User

	u.rm.RLock()
	defer u.rm.RUnlock()

	for _, user := range u.users {
		users = append(users, &User{
			Name:  user.Name,
			Color: user.Color,
			Image: user.Image,
			ID:    user.ID,
			Guest: user.Guest,
		})
	}
	return users
}
